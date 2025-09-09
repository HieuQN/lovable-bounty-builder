import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  propertyAddress: string;
  bountyId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { propertyAddress, bountyId }: NotificationRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all agent profiles with their email addresses
    const { data: agents, error: agentsError } = await supabase
      .from('agent_profiles')
      .select(`
        id,
        profiles!inner(email, first_name)
      `);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch agents" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!agents || agents.length === 0) {
      console.log("No agents found to notify");
      return new Response(
        JSON.stringify({ message: "No agents to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send emails to all agents
    const emailPromises = agents.map(async (agent) => {
      const agentEmail = agent.profiles.email;
      const agentName = agent.profiles.first_name || "Agent";

      return resend.emails.send({
        from: "IntelleHouse <notifications@lovable.app>",
        to: [agentEmail],
        subject: `New Disclosure Request Available - ${propertyAddress}`,
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">New Disclosure Request Available</h1>
            
            <p>Hello ${agentName},</p>
            
            <p>A new disclosure request has been submitted and is now available for claiming!</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; color: #1e293b;">Property Details</h2>
              <p style="margin: 5px 0;"><strong>Address:</strong> ${propertyAddress}</p>
              <p style="margin: 5px 0;"><strong>Bounty ID:</strong> ${bountyId}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get('SITE_URL')}/agent-dashboard" 
                 style="background: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                View Available Requests
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              This request is now available for claiming in your agent dashboard. 
              The first agent to claim it and upload the disclosure will earn credits.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="color: #64748b; font-size: 12px; text-align: center;">
              This email was sent by IntelleHouse. You're receiving this because you're a registered agent.
            </p>
          </div>
        `,
      });
    });

    const emailResults = await Promise.allSettled(emailPromises);
    
    const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
    const failureCount = emailResults.filter(result => result.status === 'rejected').length;

    console.log(`Notification emails sent - Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent: successCount,
      emailsFailed: failureCount
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending agent notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);