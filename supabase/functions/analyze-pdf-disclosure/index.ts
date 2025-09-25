import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { extractText } from 'https://esm.sh/unpdf@0.12.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  pdfText?: string;
  reportId: string;
  fileName?: string;
  bucket?: string;
  filePath?: string;
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

// Proper PDF text extraction using unpdf
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log(`Extracting text from PDF buffer of size: ${pdfBuffer.byteLength} bytes`);
    const uint8Array = new Uint8Array(pdfBuffer);
    const result = await extractText(uint8Array);
    
    // Handle both string and array responses
    const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
    
    console.log(`Successfully extracted ${text.length} characters from PDF`);
    
    if (text.length < 100) {
      throw new Error('Extracted text too short - may not be a valid PDF or text-based PDF');
    }
    
    return text;
  } catch (err) {
    console.error('PDF text extraction failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let reportId: string | undefined;
  try {
    const request: AnalysisRequest = await req.json();
    reportId = request.reportId;
    console.log('Received request:', { 
      reportId: request.reportId, 
      hasText: !!request.pdfText,
      fileName: request.fileName,
      textLength: request.pdfText?.length || 0
    });

    // Check if we have text directly (client-side extraction)
    if (request.pdfText && request.pdfText.length > 100) {
      console.log(`Processing with provided text (${request.pdfText.length} characters)`);
      return await processPdfAnalysis(request.pdfText, request.reportId);
    }

    // Legacy support: try analyzing from storage if bucket/filePath provided
    if (request.bucket && request.filePath) {
      console.log('Processing PDF from storage (legacy)');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: fileData, error: downloadErr } = await supabase.storage
        .from(request.bucket)
        .download(request.filePath);

      if (downloadErr || !fileData) {
        throw new Error(`Failed to download PDF from storage: ${downloadErr?.message}`);
      }
      const blob = fileData as Blob;
      const sizeMB = (blob.size || 0) / (1024 * 1024);
      console.log(`Storage PDF size: ${sizeMB.toFixed(2)} MB`);

      // For files over 20MB, extract text from first 20MB only
      if (sizeMB > 20) {
        console.log('Large PDF detected, extracting text from first 20MB...');
        const headSlice = blob.slice(0, 20 * 1024 * 1024);
        const largeBuffer = await headSlice.arrayBuffer();
        const extractedText = await extractTextFromPDF(largeBuffer);
        console.log('Using text analysis path for large PDF');
        return await processPdfAnalysis(extractedText, request.reportId);
      }

      // Small files: try text extraction first, fall back to base64 if needed
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const extractedText = await extractTextFromPDF(arrayBuffer);
        console.log('Using text analysis path for small PDF');
        return await processPdfAnalysis(extractedText, request.reportId);
      } catch (textError) {
        const errorMessage = textError instanceof Error ? textError.message : String(textError);
        console.log('Text extraction failed, trying base64 approach:', errorMessage);
        // Fall back to base64 PDF analysis
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        return await processPdfAnalysisFromPDF(base64, request.reportId);
      }
    }

    return new Response(
      JSON.stringify({ error: 'No PDF text provided. Please ensure client-side text extraction is working.' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
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
        // Persist error log
        await supabase.from('analysis_logs').insert({
          report_id: reportId,
          function_name: 'analyze-pdf-disclosure',
          level: 'error',
          message: 'Function failed',
          context: { error: error instanceof Error ? error.message : String(error) }
        });
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

async function processPdfAnalysisFromPDF(pdfBase64: string, reportId: string) {
  if (!pdfBase64 || !reportId) {
    throw new Error('Missing required fields: pdfBase64 and reportId');
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

  console.log('Updated report status to processing (PDF inline)');

  // Call Gemini API for analysis with inline PDF
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  console.log(`Gemini API Key configured: ${!!geminiApiKey}`);
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

  const systemPrompt = `You are an expert real estate analyst. Analyze the provided real estate disclosure PDF and return the same JSON schema as before.`;

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      parts: [
        { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          components: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                componentName: { type: 'STRING' },
                analysis: { type: 'STRING' },
                riskScore: { type: 'STRING', enum: ['Low','Medium','High','Unknown'] },
                estimatedCost: { type: 'STRING' },
                sourcePage: { type: 'NUMBER' }
              },
              required: ['componentName','analysis','riskScore','estimatedCost','sourcePage']
            }
          }
        },
        required: ['summary','components']
      }
    }
  };

  // Retry logic
  let response;
  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      console.log('Calling Gemini API with inline PDF...');
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(`Gemini (inline) status: ${response.status}`);
      if (response.ok) {
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error('Invalid Gemini response (inline)');
        const analysisResult: AnalysisResult = JSON.parse(jsonText);

        // Calculate overall risk score
        const riskCounts = { Low: 0, Medium: 0, High: 0, Unknown: 0 } as const;
        const counts: Record<keyof typeof riskCounts, number> = { Low:0, Medium:0, High:0, Unknown:0 };
        analysisResult.components.forEach(c => { counts[c.riskScore as keyof typeof riskCounts]++; });

        let overallRiskScore = 1;
        if (counts.High > 0) overallRiskScore = Math.min(10, 5 + counts.High * 2);
        else if (counts.Medium > 0) overallRiskScore = Math.min(7, 3 + counts.Medium);
        else if (counts.Low > 0) overallRiskScore = Math.min(4, 1 + Math.floor(counts.Low * 0.5));

        const findings = analysisResult.components.map(comp => ({
          category: comp.componentName,
          finding: comp.analysis,
          risk_level: comp.riskScore.toLowerCase(),
          estimated_cost: comp.estimatedCost,
          negotiation_point: comp.riskScore === 'High' ? 'Major concern for negotiation' : comp.riskScore === 'Medium' ? 'Moderate negotiation point' : 'Minor issue',
          source_page: comp.sourcePage
        }));

        const { error: updateError } = await supabase
          .from('disclosure_reports')
          .update({
            status: 'complete',
            risk_score: overallRiskScore,
            report_summary_basic: analysisResult.summary,
            report_summary_full: JSON.stringify({
              summary: analysisResult.summary,
              findings,
              total_components: analysisResult.components.length,
              risk_breakdown: counts
            }),
            dummy_analysis_complete: true
          })
          .eq('id', reportId);

        if (updateError) throw updateError;

        await supabase.from('analysis_logs').insert({
          report_id: reportId,
          function_name: 'analyze-pdf-disclosure',
          level: 'info',
          message: 'Report updated with Gemini (inline PDF) analysis'
        });

        try {
          // Notify agent that analysis is complete (modal upload flow)
          const { data: reportRow } = await supabase
            .from('disclosure_reports')
            .select('property_id, uploaded_by_agent_id')
            .eq('id', reportId)
            .single();

          if (reportRow?.uploaded_by_agent_id && reportRow?.property_id) {
            const { data: property } = await supabase
              .from('properties')
              .select('street_address')
              .eq('id', reportRow.property_id)
              .single();

            const { data: agent } = await supabase
              .from('agent_profiles')
              .select('user_id')
              .eq('id', reportRow.uploaded_by_agent_id)
              .single();

            if (property && agent) {
              await supabase.functions.invoke('send-disclosure-notification', {
                body: {
                  propertyAddress: property.street_address,
                  reportId: reportId,
                  userId: agent.user_id
                }
              });
            }
          }
        } catch (e) {
          console.error('Notification send failed:', e);
        }

        return new Response(JSON.stringify({ success: true, reportId, riskScore: overallRiskScore, summary: analysisResult.summary }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (response.status === 429 || response.status >= 500) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; retries--; continue;
      }
      throw new Error(`Gemini inline request failed: ${response.status}`);
    } catch (e) {
      if (retries === 1) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2; retries--;
    }
  }

  throw new Error('Failed to get response from Gemini (inline) after retries');
}

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

    // Persist log: analysis started
    await supabase.from('analysis_logs').insert({
      report_id: reportId,
      function_name: 'analyze-pdf-disclosure',
      level: 'info',
      message: 'Analysis started',
      context: { pdfTextLength: pdfText.length }
    });

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

        // Persist success log
        await supabase.from('analysis_logs').insert({
          report_id: reportId,
          function_name: 'analyze-pdf-disclosure',
          level: 'info',
          message: 'Report updated with Gemini analysis',
          context: { overallRiskScore, riskCounts }
        });

        console.log('Successfully updated report with analysis results');

            try {
              // Notify agent that analysis is complete (modal upload flow)
              const { data: reportRow } = await supabase
                .from('disclosure_reports')
                .select('property_id, uploaded_by_agent_id')
                .eq('id', reportId)
                .single();

              if (reportRow?.uploaded_by_agent_id && reportRow?.property_id) {
                const { data: property } = await supabase
                  .from('properties')
                  .select('street_address')
                  .eq('id', reportRow.property_id)
                  .single();

                const { data: agent } = await supabase
                  .from('agent_profiles')
                  .select('user_id')
                  .eq('id', reportRow.uploaded_by_agent_id)
                  .single();

                if (property && agent) {
                  await supabase.functions.invoke('send-disclosure-notification', {
                    body: {
                      propertyAddress: property.street_address,
                      reportId: reportId,
                      userId: agent.user_id
                    }
                  });
                }
              }
            } catch (e) {
              console.error('Notification send failed:', e);
            }

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