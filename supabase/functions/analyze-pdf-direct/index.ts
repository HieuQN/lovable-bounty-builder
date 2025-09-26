import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const reportId = formData.get('reportId') as string;
    
    if (!pdfFile || !reportId) {
      throw new Error('PDF file and report ID are required');
    }

    console.log('Processing PDF directly for report:', reportId);
    
    // Read original PDF bytes and prepare for inline upload (no preprocessing)
    const pdfBytes = await pdfFile.arrayBuffer();
    const mimeType = (pdfFile.type || 'application/pdf');
    const base64Data = base64Encode(new Uint8Array(pdfBytes));

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await supabase
      .from('disclosure_reports')
      .update({ status: 'processing' })
      .eq('id', reportId);

    // Call Gemini API directly
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
    
    const payload = {
      systemInstruction: {
        parts: [{ text: "You are an expert real estate analyst. Analyze the attached disclosure PDF and provide a JSON response with summary and components array. Each component should have componentName, analysis, riskScore (Low/Medium/High/Unknown), estimatedCost (string), and sourcePage (number)." }]
      },
      contents: [{
        parts: [
          { text: "Analyze this original real estate disclosure PDF. Extract content as needed. Return strictly the requested JSON." },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            components: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  componentName: { type: "STRING" },
                  analysis: { type: "STRING" },
                  riskScore: { type: "STRING", enum: ["Low", "Medium", "High", "Unknown"] },
                  estimatedCost: { type: "STRING" },
                  sourcePage: { type: "NUMBER" }
                },
                required: ["componentName", "analysis", "riskScore", "estimatedCost", "sourcePage"]
              }
            }
          },
          required: ["summary", "components"]
        }
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        let retryAfterSeconds: number | undefined;
        try {
          const errJson = JSON.parse(errorText);
          const retryInfo = errJson?.error?.details?.find((d: any) => d?.['@type']?.includes('RetryInfo'));
          const retryStr: string | undefined = retryInfo?.retryDelay;
          const m = retryStr?.match(/(\d+)/);
          if (m) retryAfterSeconds = parseInt(m[1], 10);
        } catch {}
        // Mark report as failed due to rate limit
        await supabase
          .from('disclosure_reports')
          .update({ status: 'failed' })
          .eq('id', reportId);
        // Log error context
        await supabase.from('analysis_logs').insert({
          report_id: reportId,
          function_name: 'analyze-pdf-direct',
          level: 'error',
          message: 'Gemini API rate limited',
          context: { error: errorText, retryAfterSeconds }
        });
        return new Response(
          JSON.stringify({
            error: 'rate_limited',
            message: 'Gemini API quota exceeded. Please retry later.',
            retryAfterSeconds,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Gemini API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
      throw new Error("No response from Gemini API");
    }

    const analysisResult = JSON.parse(jsonText);
    
    // Calculate risk score
    const riskCounts = { Low: 0, Medium: 0, High: 0, Unknown: 0 };
    analysisResult.components.forEach((comp: any) => {
      riskCounts[comp.riskScore as keyof typeof riskCounts]++;
    });

    let overallRiskScore = 1;
    if (riskCounts.High > 0) {
      overallRiskScore = Math.min(10, 5 + riskCounts.High * 2);
    } else if (riskCounts.Medium > 0) {
      overallRiskScore = Math.min(7, 3 + riskCounts.Medium);
    } else if (riskCounts.Low > 0) {
      overallRiskScore = Math.min(4, 1 + riskCounts.Low * 0.5);
    }

    // Update report with results
    await supabase
      .from('disclosure_reports')
      .update({
        status: 'complete',
        risk_score: overallRiskScore,
        report_summary_basic: analysisResult.summary,
        report_summary_full: JSON.stringify({
          summary: analysisResult.summary,
          findings: analysisResult.components,
          total_components: analysisResult.components.length,
          risk_breakdown: riskCounts
        }),
        dummy_analysis_complete: true
      })
      .eq('id', reportId);

    return new Response(JSON.stringify({ 
      success: true, 
      reportId,
      summary: analysisResult.summary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  // Basic PDF text extraction
  const uint8Array = new Uint8Array(pdfBuffer);
  const text = new TextDecoder().decode(uint8Array);
  
  // Extract readable text between stream markers
  const textMatch = text.match(/stream\s*(.*?)\s*endstream/gs);
  if (textMatch) {
    return textMatch.map(match => 
      match.replace(/stream|endstream/g, '')
           .replace(/[^\x20-\x7E\n\r]/g, ' ')
           .replace(/\s+/g, ' ')
           .trim()
    ).join(' ');
  }
  
  // Fallback: try to extract any readable text
  const readableText = text.replace(/[^\x20-\x7E\n\r]/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim();
  
  return readableText.length > 100 ? readableText : 'Unable to extract text from PDF';
}