import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const demoUserEmail = 'demo@intellehouse.com';
  const demoAgentEmail = 'agent@intellehouse.com';
  const demoPassword = 'demo123';

  try {
    let buyerUserId, agentUserId;

    // Try to create buyer user, handle if already exists
    try {
      const { data: buyerAuthData, error: buyerAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: demoUserEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          first_name: 'Demo'
        }
      });

      if (buyerAuthError) {
        if (buyerAuthError.message.includes('already registered')) {
          console.log('Buyer already exists, finding existing user...');
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingBuyerUser = existingUsers.users.find(u => u.email === demoUserEmail);
          if (existingBuyerUser) {
            buyerUserId = existingBuyerUser.id;
            console.log('Found existing buyer:', buyerUserId);
          }
        } else {
          throw buyerAuthError;
        }
      } else {
        buyerUserId = buyerAuthData.user.id;
        console.log('Created new buyer:', buyerUserId);
      }
    } catch (error) {
      console.error('Error with buyer account:', error);
    }

    // Try to create agent user, handle if already exists
    try {
      const { data: agentAuthData, error: agentAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: demoAgentEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          first_name: 'Agent Demo'
        }
      });

      if (agentAuthError) {
        if (agentAuthError.message.includes('already registered')) {
          console.log('Agent already exists, finding existing user...');
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingAgentUser = existingUsers.users.find(u => u.email === demoAgentEmail);
          if (existingAgentUser) {
            agentUserId = existingAgentUser.id;
            console.log('Found existing agent:', agentUserId);
          }
        } else {
          throw agentAuthError;
        }
      } else {
        agentUserId = agentAuthData.user.id;
        console.log('Created new agent:', agentUserId);
      }
    } catch (error) {
      console.error('Error with agent account:', error);
    }

    // Create/update buyer profile if we have a buyer user ID
    if (buyerUserId) {
      const { error: buyerProfileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: buyerUserId,
          email: demoUserEmail,
          first_name: 'Demo',
          user_type: 'Buyer',
          credits: 1000,
          is_verified: true
        });

      if (buyerProfileError) {
        console.error('Error upserting buyer profile:', buyerProfileError);
      } else {
        console.log('Buyer profile updated successfully');
      }
    }

    // Create/update agent profile if we have an agent user ID
    if (agentUserId) {
      const { error: agentProfileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: agentUserId,
          email: demoAgentEmail,
          first_name: 'Agent Demo',
          user_type: 'Agent',
          credits: 0,
          is_verified: true
        });

      if (agentProfileError) {
        console.error('Error upserting agent profile:', agentProfileError);
      } else {
        console.log('Agent profile updated successfully');
      }

      // Create/update agent details
      const { error: agentDetailsError } = await supabaseAdmin
        .from('agent_profiles')
        .upsert({
          user_id: agentUserId,
          license_number: 'RE-12345-DEMO',
          brokerage_name: 'Demo Realty Group',
          credit_balance: 150,
          service_areas: ['San Francisco', 'Los Angeles', 'San Diego'],
          profile_bio: 'Demo agent for testing the platform'
        });

      if (agentDetailsError) {
        console.error('Error upserting agent details:', agentDetailsError);
      } else {
        console.log('Agent details updated successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Demo accounts created/updated successfully',
        buyerEmail: demoUserEmail,
        agentEmail: demoAgentEmail,
        password: demoPassword,
        buyerUserId,
        agentUserId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check function logs for more information'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
};

serve(handler);