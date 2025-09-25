import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  pdfText: string;
  reportId: string;
}

interface AnalysisComponent {
  componentName: string;
  analysis: string;
  riskScore: 'Low' | 'Medium' | 'High' | 'Unknown';
  estimatedCost: string;
  sourcePage: number;
}

interface AnalysisResult {
  summary: string;
  components: AnalysisComponent[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let reportId: string | undefined;
  try {
    const { pdfText, reportId: requestReportId }: AnalysisRequest = await req.json();
    reportId = requestReportId;
    console.log(`Starting PDF analysis for report: ${reportId}`);
    console.log(`PDF text length: ${pdfText?.length || 0} characters`);
    
    // Check if PDF text is too large (approximate token limit)
    if (pdfText.length > 800000) { // ~200k tokens
      console.log('PDF text too large, truncating...');
      const truncatedText = pdfText.substring(0, 800000) + "\n\n[Note: Document was truncated due to size limitations]";
      return await processPdfAnalysis(truncatedText, reportId);
    }

    return await processPdfAnalysis(pdfText, reportId);
    
  } catch (error) {
    console.error('Error in analyze-pdf-disclosure function:', error);
    
    // Try to update report status to error if we have reportId
    if (reportId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('disclosure_reports')
          .update({ status: 'error' })
          .eq('id', reportId);
      } catch (updateError) {
        console.error('Failed to update report status to error:', updateError);
      }
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processPdfAnalysis(pdfText: string, reportId: string) {
  if (!pdfText || !reportId) {
    throw new Error('Missing required fields: pdfText and reportId');
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update report status to processing
    await supabase
      .from('disclosure_reports')
      .update({ status: 'processing' })
      .eq('id', reportId);

    console.log('Updated report status to processing');

    // Call Gemini API for analysis
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    console.log(`Gemini API Key configured: ${!!geminiApiKey}`);
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const systemPrompt = `You are an expert real estate analyst. Your task is to analyze the provided real estate disclosure document text, which is formatted with page numbers. 
1.  Provide a concise overall summary of the property's condition based on the disclosure.
2.  Identify key components of the property (e.g., Roof, Foundation, Electrical System, Plumbing, HVAC, Appliances, Pests, etc.).
3.  For each component, provide a brief analysis of its stated condition.
4.  Assign a risk score: "Low", "Medium", "High", or "Unknown".
5.  Provide an estimated cost to fix any noted issues as a string (e.g., "$500 - $1,500" or "N/A"). Be realistic with the cost estimates.
6.  For each component, cite the source page number from the document where the information was found.

Return the result in the specified JSON format.`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: `Here is the text from the real estate disclosure PDF:\n\n${pdfText}` }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING", description: "Overall summary of the property's condition." },
            components: {
              type: "ARRAY",
              description: "Detailed analysis of each property component.",
              items: {
                type: "OBJECT",
                properties: {
                  componentName: { type: "STRING", description: "Name of the property component (e.g., Roof, Foundation)." },
                  analysis: { type: "STRING", description: "Brief analysis of the component's condition." },
                  riskScore: { type: "STRING", enum: ["Low", "Medium", "High", "Unknown"], description: "Assessed risk level." },
                  estimatedCost: { type: "STRING", description: "Estimated cost for repairs, if any (e.g., $1000 - $2000 or N/A)." },
                  sourcePage: { type: "NUMBER", description: "The page number in the PDF where this information was found." }
                },
                required: ["componentName", "analysis", "riskScore", "estimatedCost", "sourcePage"]
              }
            }
          },
          required: ["summary", "components"]
        }
      }
    };

    console.log('Calling Gemini API...');

    // Exponential backoff for retries
    let response;
    let retries = 3;
    let delay = 1000;
    
    while (retries > 0) {
      try {
        console.log(`Attempt ${4 - retries}, making request to Gemini API...`);
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log(`Gemini API response status: ${response.status}`);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`Gemini API result received, candidates: ${result.candidates?.length || 0}`);
          
          const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            console.log(`Analysis text length: ${jsonText.length} characters`);
            const analysisResult: AnalysisResult = JSON.parse(jsonText);
            console.log(`Analysis completed successfully, components: ${analysisResult.components?.length || 0}`);

            // Calculate overall risk score
            const riskCounts = { Low: 0, Medium: 0, High: 0, Unknown: 0 };
            analysisResult.components.forEach(comp => {
              riskCounts[comp.riskScore as keyof typeof riskCounts]++;
            });

            let overallRiskScore = 1; // Default to low risk
            if (riskCounts.High > 0) {
              overallRiskScore = Math.min(10, 5 + riskCounts.High * 2); // 5-10 for high risk items
            } else if (riskCounts.Medium > 0) {
              overallRiskScore = Math.min(7, 3 + riskCounts.Medium); // 3-7 for medium risk items
            } else if (riskCounts.Low > 0) {
              overallRiskScore = Math.min(4, 1 + riskCounts.Low * 0.5); // 1-4 for low risk items
            }

            // Format findings for storage
            const findings = analysisResult.components.map(comp => ({
              category: comp.componentName,
              finding: comp.analysis,
              risk_level: comp.riskScore.toLowerCase(),
              estimated_cost: comp.estimatedCost,
              negotiation_point: comp.riskScore === 'High' ? 'Major concern for negotiation' : 
                                comp.riskScore === 'Medium' ? 'Moderate negotiation point' : 'Minor issue',
              source_page: comp.sourcePage
            }));

            // Update the report with analysis results
            const { error: updateError } = await supabase
              .from('disclosure_reports')
              .update({
                status: 'complete',
                risk_score: overallRiskScore,
                report_summary_basic: analysisResult.summary,
                report_summary_full: JSON.stringify({
                  summary: analysisResult.summary,
                  findings: findings,
                  total_components: analysisResult.components.length,
                  risk_breakdown: riskCounts
                }),
                dummy_analysis_complete: true
              })
              .eq('id', reportId);

            if (updateError) {
              throw updateError;
            }

            console.log('Successfully updated report with analysis results');

            return new Response(JSON.stringify({ 
              success: true, 
              reportId,
              riskScore: overallRiskScore,
              summary: analysisResult.summary 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

          } else {
            throw new Error("Invalid response structure from Gemini API.");
          }
        } else if (response.status === 429 || response.status >= 500) {
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
          retries--;
        } else {
          throw new Error(`Gemini API request failed with status: ${response.status}`);
        }
      } catch (e) {
        if (retries === 1) throw e;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
        retries--;
      }
    }

    throw new Error('Failed to get response from Gemini API after retries');
}