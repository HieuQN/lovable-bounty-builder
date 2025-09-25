import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PDF parsing function
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    // Simple text extraction - in production, use a proper PDF library
    const uint8Array = new Uint8Array(pdfBuffer);
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
    let text = decoder.decode(uint8Array);
    
    // Basic PDF text extraction (this is a fallback - in production use proper PDF parsing)
    // Remove PDF binary content and extract readable text
    const textMatch = text.match(/BT\s*(.*?)\s*ET/gs);
    if (textMatch) {
      text = textMatch.map(match => match.replace(/BT\s*|\s*ET/g, '')).join(' ');
    }
    
    // Clean up the text
    text = text
      .replace(/[^\x20-\x7E\s]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (text.length < 100) {
      // If extraction failed, return a descriptive message
      return `PDF document uploaded with ${uint8Array.length} bytes of content. Manual text extraction required for detailed analysis.`;
    }
    
    return text;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return 'PDF text extraction failed. Manual review required.';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Missing jobId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting background processing for job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('disclosure_upload_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Error fetching job:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing file: ${job.file_path}`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('disclosure-uploads')
      .download(job.file_path);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      await supabaseClient.rpc('update_upload_job_status', {
        job_id: jobId,
        new_status: 'failed',
        error_msg: 'Failed to download file'
      });
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert file to ArrayBuffer and extract text
    const arrayBuffer = await fileData.arrayBuffer();
    console.log(`Extracting text from PDF: ${job.file_name}`);
    
    // Extract text from PDF
    const pdfText = await extractTextFromPDF(arrayBuffer);
    console.log(`Extracted ${pdfText.length} characters from PDF`);

    // Get the property_id from the bounty
    const { data: bounty, error: bountyError } = await supabaseClient
      .from('disclosure_bounties')
      .select('property_id')
      .eq('id', job.bounty_id)
      .single();

    if (bountyError || !bounty) {
      console.error('Error fetching bounty:', bountyError);
      await supabaseClient.rpc('update_upload_job_status', {
        job_id: jobId,
        new_status: 'failed',
        error_msg: 'Bounty not found'
      });
      return new Response(JSON.stringify({ error: 'Bounty not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create disclosure report first
    const { data: report, error: reportError } = await supabaseClient
      .from('disclosure_reports')
      .insert({
        property_id: bounty.property_id,
        uploaded_by_agent_id: job.agent_id,
        status: 'processing',
        raw_pdf_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/disclosure-uploads/${job.file_path}`
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('Error creating report:', reportError);
      await supabaseClient.rpc('update_upload_job_status', {
        job_id: jobId,
        new_status: 'failed',
        error_msg: `Failed to create report: ${reportError?.message}`
      });
      return new Response(JSON.stringify({ error: 'Failed to create report' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the AI analysis function with extracted text
    const { data: analysisResult, error: analysisError } = await supabaseClient.functions.invoke(
      'analyze-pdf-disclosure',
      {
        body: { 
          pdfText: pdfText,
          reportId: report.id
        }
      }
    );

    if (analysisError) {
      console.error('Error in AI analysis:', analysisError);
      await supabaseClient.rpc('update_upload_job_status', {
        job_id: jobId,
        new_status: 'failed',
        error_msg: `AI analysis failed: ${analysisError.message}`
      });
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('AI analysis completed successfully');

    // Update bounty status to completed
    await supabaseClient
      .from('disclosure_bounties')
      .update({ status: 'completed' })
      .eq('id', job.bounty_id);

    // Mark job as completed
    await supabaseClient.rpc('update_upload_job_status', {
      job_id: jobId,
      new_status: 'completed'
    });

    console.log(`Successfully processed job: ${jobId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'File processed successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in background processing:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});