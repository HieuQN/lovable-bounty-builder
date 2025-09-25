import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple PDF text extraction function
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    // Convert to Uint8Array for text extraction
    const uint8Array = new Uint8Array(pdfBuffer);
    
    // Simple text extraction approach for PDFs
    // This is a basic implementation - in production, use a proper PDF parsing library
    let text = '';
    let i = 0;
    
    // Look for text streams in PDF
    while (i < uint8Array.length - 1) {
      // Look for "BT" (Begin Text) markers
      if (uint8Array[i] === 66 && uint8Array[i + 1] === 84) { // "BT"
        i += 2;
        let textContent = '';
        
        // Extract text until "ET" (End Text) marker
        while (i < uint8Array.length - 1) {
          if (uint8Array[i] === 69 && uint8Array[i + 1] === 84) { // "ET"
            break;
          }
          
          // Extract readable characters
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
    
    // Clean up extracted text
    text = text
      .replace(/[^\w\s\.\,\;\:\!\?\-\$\%\(\)]/g, ' ') // Keep basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // If we couldn't extract much text, provide a basic description
    if (text.length < 50) {
      text = `Property disclosure document uploaded. File size: ${uint8Array.length} bytes. Contains property information and disclosures requiring manual review for detailed analysis.`;
    }
    
    return text;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return 'PDF document uploaded successfully. Text extraction failed - manual review required for detailed analysis.';
  }
}

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

    // Log job fetched
    await supabaseClient.from('analysis_logs').insert({
      job_id: jobId,
      function_name: 'process-background-upload',
      level: 'info',
      message: 'Job fetched',
      context: { file_path: job.file_path, agent_id: job.agent_id, bounty_id: job.bounty_id }
    });

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('disclosure-uploads')
      .download(job.file_path);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      await supabaseClient.from('analysis_logs').insert({
        job_id: jobId,
        function_name: 'process-background-upload',
        level: 'error',
        message: 'Failed to download file from storage',
        context: { error: downloadError?.message, file_path: job.file_path }
      });
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
    
    // Log extraction result
    await supabaseClient.from('analysis_logs').insert({
      job_id: jobId,
      function_name: 'process-background-upload',
      level: 'info',
      message: 'PDF text extracted',
      context: { file_name: job.file_name, length: pdfText.length }
    });

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
        report_summary_basic: 'Processing disclosure analysis...',
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

    // Log report created
    await supabaseClient.from('analysis_logs').insert({
      job_id: jobId,
      report_id: report.id,
      function_name: 'process-background-upload',
      level: 'info',
      message: 'Report created',
      context: { report_id: report.id, property_id: bounty.property_id }
    });

    console.log(`Calling AI analysis for report: ${report.id}`);
    
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
      
      // Log AI analysis error
      await supabaseClient.from('analysis_logs').insert({
        job_id: jobId,
        report_id: report.id,
        function_name: 'process-background-upload',
        level: 'error',
        message: 'AI analysis failed',
        context: { error: analysisError.message }
      });
      
      // Update report with error
      await supabaseClient
        .from('disclosure_reports')
        .update({ 
          status: 'error',
          report_summary_basic: `Analysis failed: ${analysisError.message}` 
        })
        .eq('id', report.id);
        
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

    // Log success
    await supabaseClient.from('analysis_logs').insert({
      job_id: jobId,
      report_id: report.id,
      function_name: 'process-background-upload',
      level: 'info',
      message: 'AI analysis completed successfully'
    });

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
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});