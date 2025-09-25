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

// Note: Text extraction function removed as we now use direct Gemini API processing
// which handles PDF content directly without needing to extract text first

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

    // Run analysis in background to avoid timeouts/memory pressure
    const backgroundTask = async () => {
      try {
        await supabase.from('analysis_logs').insert({
          report_id: report.id,
          function_name: 'extract-analyze-disclosure',
          level: 'info',
          message: 'Starting background analysis',
          context: { bucket, file_path }
        });

        // Get the PDF file and convert to base64 for direct Gemini analysis
        const { data: fileData, error: fileError } = await supabase.storage
          .from(bucket)
          .download(file_path);

        if (fileError || !fileData) {
          throw new Error(`Failed to download file: ${fileError?.message}`);
        }

        // Convert to base64
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Invoke new direct analysis function
        const { error: aiErr } = await supabase.functions.invoke('gemini-direct-analysis', {
          body: { 
            reportId: report.id, 
            pdfBase64: base64,
            fileName: file_path.split('/').pop() || 'disclosure.pdf'
          }
        });

        if (aiErr) {
          await supabase.from('analysis_logs').insert({
            report_id: report.id,
            function_name: 'extract-analyze-disclosure',
            level: 'error',
            message: 'AI analysis invocation failed',
            context: { error: aiErr.message }
          });

          await supabase
            .from('disclosure_reports')
            .update({ status: 'error', report_summary_basic: 'AI analysis failed to start' })
            .eq('id', report.id);
          return;
        }

        // Mark bounty completed only after analysis invocation
        if (bounty_id) {
          await supabase.from('disclosure_bounties').update({ status: 'completed' }).eq('id', bounty_id);
        }

        await supabase.from('analysis_logs').insert({
          report_id: report.id,
          function_name: 'extract-analyze-disclosure',
          level: 'info',
          message: 'AI analysis invoked successfully (background)'
        });
      } catch (err) {
        console.error('Background task error:', err);
        await supabase.from('analysis_logs').insert({
          report_id: report.id,
          function_name: 'extract-analyze-disclosure',
          level: 'error',
          message: 'Background task failed',
          context: { error: err instanceof Error ? err.message : String(err) }
        });
      }
    };

    // Start without blocking response
    backgroundTask().catch(console.error);

    return new Response(JSON.stringify({ success: true, report_id: report.id }), {
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
