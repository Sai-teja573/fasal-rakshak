
// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions/quickstart
// 1. supabase functions new send-email
// 2. Paste this code into index.ts
// 3. supabase secrets set RESEND_API_KEY=your_key_here
// 4. supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: any;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!RESEND_API_KEY) {
        throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // For testing use "onboarding@resend.dev", for prod use your verified domain
        from: "Fasal Rakshak <onboarding@resend.dev>", 
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
