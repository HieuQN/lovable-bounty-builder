import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  property_id: string;
  agent_profile_id: string;
  bucket?: string; // default: disclosures
  file_path: string; // e.g. propertyId/timestamp_filename.pdf
  bounty_id?: string | null;
};

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    let text = '';
    let i = 0;
    while (i < uint8Array.length - 1) {
      if (uint8Array[i] === 66 && uint8Array[i + 1] === 84) { // "BT"
        i += 2;
        let textContent = '';
        while (i < uint8Array.length - 1) {
          if (uint8Array[i] === 69 && uint8Array[i + 1] === 84) { // "ET"
            break;
          }
          if (uint8Array[i] >= 32 && uint8Array[i] <= 126) {
            textContent += String.fromCharCode(uint8Array[i]);
          } else if (uint8Array[i] === 10 || uint8Array[i] === 13) {
            textContent += ' ';
          }
          i++;
        }
        text += textContent + ' ';
      }
      i++;
    }
    text = text
      .replace(/[^\w\s\.,;:!\?\-\$%()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 50) {
      text = `Property disclosure document uploaded. Length: ${uint8Array.length} bytes.`;
    }
    return text;
  } catch (e) {
    console.error('PDF extraction error:', e);
    return 'PDF uploaded; text extraction failed.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body: Body = await req.json();
    const { property_id, agent_profile_id, file_path, bounty_id } = body;
    const bucket = body.bucket || 'disclosures';

    if (!property_id || !agent_profile_id || !file_path) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create processing report first
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${file_path}`;
    const { data: report, error: reportError } = await supabase
      .from('disclosure_reports')
      .insert({
        property_id,
        uploaded_by_agent_id: agent_profile_id,
        status: 'processing',
        report_summary_basic: 'Processing disclosure analysis...',
        raw_pdf_url: publicUrl,
      })
      .select()
      .single();

    if (reportError || !report) {
      throw new Error(`Failed to create report: ${reportError?.message}`);
    }

    // Log start
    await supabase.from('analysis_logs').insert({
      report_id: report.id,
      function_name: 'extract-analyze-disclosure',
      level: 'info',
      message: 'Report created; starting extraction',
      context: { bucket, file_path }
    });

    // Download from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(file_path);

    if (downloadError || !fileData) {
      await supabase
        .from('disclosure_reports')
        .update({ status: 'error', report_summary_basic: 'Failed to download file for analysis' })
        .eq('id', report.id);
      await supabase.from('analysis_logs').insert({
        report_id: report.id,
        function_name: 'extract-analyze-disclosure',
        level: 'error',
        message: 'Download failed',
        context: { error: downloadError?.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfText = await extractTextFromPDF(arrayBuffer);

    // Log extraction
    await supabase.from('analysis_logs').insert({
      report_id: report.id,
      function_name: 'extract-analyze-disclosure',
      level: 'info',
      message: 'Text extracted',
      context: { length: pdfText.length }
    });

    // Call Gemini analysis function (send storage reference to allow inline PDF parsing)
    const { data: aiRes, error: aiErr } = await supabase.functions.invoke('analyze-pdf-disclosure', {
      body: { reportId: report.id, bucket, filePath: file_path }
    });

    if (aiErr) {
      await supabase.from('analysis_logs').insert({
        report_id: report.id,
        function_name: 'extract-analyze-disclosure',
        level: 'error',
        message: 'Gemini analysis invocation failed',
        context: { error: aiErr.message }
      });
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If provided, mark bounty completed
    if (bounty_id) {
      await supabase.from('disclosure_bounties').update({ status: 'completed' }).eq('id', bounty_id);
    }

    await supabase.from('analysis_logs').insert({
      report_id: report.id,
      function_name: 'extract-analyze-disclosure',
      level: 'info',
      message: 'AI analysis completed via Gemini'
    });

    return new Response(JSON.stringify({ success: true, report_id: report.id, aiRes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('extract-analyze-disclosure error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
