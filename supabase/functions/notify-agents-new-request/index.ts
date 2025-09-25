import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get all agent profiles
    const { data: agents, error: agentsError } = await supabase
      .from('agent_profiles')
      .select('id, user_id');

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

    // Create in-app notifications for all agents
    const notificationPromises = agents.map(async (agent) => {
      return supabase.functions.invoke('create-notification', {
        body: {
          user_id: agent.user_id,
          message: `New disclosure request available for ${propertyAddress}`,
          type: 'bounty_available',
          url: '/agent-dashboard?tab=bounties'
        }
      });
    });

    const notificationResults = await Promise.allSettled(notificationPromises);
    
    const successCount = notificationResults.filter(result => result.status === 'fulfilled').length;
    const failureCount = notificationResults.filter(result => result.status === 'rejected').length;

    console.log(`In-app notifications sent - Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      notificationsSent: successCount,
      notificationsFailed: failureCount
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error sending agent notifications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);