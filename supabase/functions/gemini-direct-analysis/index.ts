import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DirectAnalysisRequest {
  reportId: string;
  pdfBase64: string;
  fileName: string;
}

interface AnalysisComponent {
  category: string;
  item: string;
  condition: string;
  concern_level: number;
  details: string;
}

interface AnalysisResult {
  summary: string;
  overall_risk_score: number;
  key_findings: string[];
  components: AnalysisComponent[];
}

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Direct Gemini analysis started');
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const request: DirectAnalysisRequest = await req.json();
    console.log(`Received direct analysis request for report: ${request.reportId}, file: ${request.fileName}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Update report status to processing
    await supabase
      .from('disclosure_reports')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', request.reportId);

    console.log('Updated report status to processing (direct Gemini)');

    // Call Gemini API with inline PDF
    console.log('Calling Gemini API with inline PDF...');
    
    const geminiPayload = {
      "generationConfig": {
        "responseMimeType": "application/json",
        "responseSchema": {
          "type": "object",
          "properties": {
            "summary": {
              "type": "string",
              "description": "A comprehensive summary of the property condition and disclosure findings"
            },
            "overall_risk_score": {
              "type": "number",
              "description": "Overall risk assessment score from 1-10"
            },
            "key_findings": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of the most important findings and concerns"
            },
            "components": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "category": {"type": "string"},
                  "item": {"type": "string"},
                  "condition": {"type": "string"},
                  "concern_level": {"type": "number"},
                  "details": {"type": "string"}
                }
              }
            }
          }
        }
      },
      "contents": [
        {
          "parts": [
            {
              "text": `You are a professional property inspector analyzing a real estate disclosure document. Please provide a comprehensive analysis of the property condition based on the disclosure information.

Focus on:
1. Overall property condition assessment
2. Major systems (HVAC, electrical, plumbing, structural)
3. Safety concerns and compliance issues
4. Environmental hazards
5. Maintenance and repair needs
6. Financial implications for buyers

Rate each component's concern level from 1-10 where:
- 1-3: Minor issues, cosmetic concerns
- 4-6: Moderate issues requiring attention
- 7-8: Significant problems requiring immediate action
- 9-10: Major safety or structural concerns

Provide practical, actionable insights for potential buyers.`
            },
            {
              "inline_data": {
                "mime_type": "application/pdf",
                "data": request.pdfBase64
              }
            }
          ]
        }
      ]
    };

    let attempt = 0;
    const maxRetries = 3;
    let lastError: any;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiPayload),
          }
        );

        console.log(`Gemini (direct) status: ${geminiResponse.status}`);

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          throw new Error(`Gemini API error (${geminiResponse.status}): ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid response structure from Gemini API');
        }

        const analysisText = geminiData.candidates[0].content.parts[0].text;
        console.log('Successfully received analysis from Gemini');

        // Parse the JSON response
        let analysisResult: AnalysisResult;
        try {
          analysisResult = JSON.parse(analysisText);
        } catch (parseError) {
          console.error('Failed to parse Gemini response as JSON:', parseError);
          throw new Error('Invalid JSON response from analysis');
        }

        // Calculate overall risk score if not provided
        if (!analysisResult.overall_risk_score && analysisResult.components?.length > 0) {
          const avgConcern = analysisResult.components.reduce((sum, comp) => sum + comp.concern_level, 0) / analysisResult.components.length;
          analysisResult.overall_risk_score = Math.round(avgConcern * 10) / 10;
        }

        // Format findings for database storage
        const formattedFindings = analysisResult.components?.map(comp => ({
          category: comp.category || 'General',
          item: comp.item || 'Unknown',
          condition: comp.condition || 'Not specified',
          concern_level: Math.max(1, Math.min(10, comp.concern_level || 5)),
          details: comp.details || ''
        })) || [];

        // Update the disclosure report with analysis results
        const { error: updateError } = await supabase
          .from('disclosure_reports')
          .update({
            status: 'complete',
            analysis_summary: analysisResult.summary,
            overall_risk_score: analysisResult.overall_risk_score,
            key_findings: analysisResult.key_findings || [],
            findings: formattedFindings,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.reportId);

        if (updateError) {
          console.error('Failed to update report:', updateError);
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`Successfully completed direct analysis for report ${request.reportId}`);

        return new Response(JSON.stringify({
          success: true,
          analysis: analysisResult,
          reportId: request.reportId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        lastError = error;
        console.error(`Gemini API attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError;

  } catch (error) {
    console.error('Error in gemini-direct-analysis function:', error);
    
    // Try to update report status to error if we have the reportId
    try {
      const request = await req.json();
      if (request.reportId && supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('disclosure_reports')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.reportId);
      }
    } catch (updateError) {
      console.error('Failed to update report status to error:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});