import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessAnalysisRequest {
  reportId: string;
  propertyAddress: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, propertyAddress }: ProcessAnalysisRequest = await req.json();

    console.log(`Starting dummy analysis for report ${reportId}, property: ${propertyAddress}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update status to processing
    const { error: updateError } = await supabase
      .from('disclosure_reports')
      .update({ status: 'processing' })
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating status to processing:', updateError);
      throw updateError;
    }

    console.log('Status updated to processing, starting 15 second delay...');

    // Simulate processing time (15 seconds)
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Generate dummy analysis data
    const riskScore = Math.round((Math.random() * 7 + 2) * 10) / 10; // 2.0 to 9.0
    
    const analysisData = {
      risk_score: riskScore,
      summary_teaser: `This report for ${propertyAddress} has been processed. Our initial scan highlights potential items of interest in the foundation and roofing sections. Unlock the full report for a detailed breakdown.`,
      findings: [
        {
          category: "Foundation",
          issue: "Seller noted 'minor seasonal dampness' in the southwest corner of the basement. A hairline crack was previously sealed in 2019.",
          risk_level: "Medium",
          estimated_cost: "$500 - $3,500",
          negotiation_point: "Recommend a foundation inspection contingency. Could be a minor issue or a sign of hydrostatic pressure. A potential point for a seller credit towards waterproofing."
        },
        {
          category: "Roof",
          issue: "Roof is 18 years old (Asphalt Shingle). Seller is not aware of any current leaks.",
          risk_level: "Medium",
          estimated_cost: "$8,000 - $15,000",
          negotiation_point: "An 18-year-old roof is near the end of its typical lifespan. This is a major upcoming expense. Use this to negotiate on price or request a credit, as replacement will likely be needed within 5 years."
        },
        {
          category: "Electrical",
          issue: "Home contains some ungrounded two-prong outlets. Electrical panel is Federal Pacific.",
          risk_level: "High",
          estimated_cost: "$2,500 - $6,000",
          negotiation_point: "Federal Pacific panels are widely considered a fire hazard and may not be insurable. This is a significant safety and financial issue. Strongly recommend requesting the seller replace the panel as a condition of the sale."
        }
      ]
    };

    // Update report with analysis results
    const { error: completeError } = await supabase
      .from('disclosure_reports')
      .update({
        status: 'complete',
        dummy_analysis_complete: true,
        risk_score: riskScore,
        report_summary_basic: analysisData.summary_teaser,
        report_summary_full: JSON.stringify(analysisData)
      })
      .eq('id', reportId);

    if (completeError) {
      console.error('Error completing analysis:', completeError);
      throw completeError;
    }

    console.log(`Analysis completed for report ${reportId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Analysis completed successfully' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in process-analysis function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);