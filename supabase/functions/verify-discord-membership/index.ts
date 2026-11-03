import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ authorized: false, error: "Methode niet toegestaan." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse({ authorized: false, error: "Aanmelden is vereist." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const guildId = Deno.env.get("DISCORD_GUILD_ID");
  if (!supabaseUrl || !supabaseKey || !botToken || !guildId || !/^\d{17,20}$/.test(guildId)) {
    console.error("Missing required membership-check environment variables.");
    return jsonResponse({ authorized: false, error: "De servercontrole is niet volledig ingesteld." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return jsonResponse({ authorized: false, error: "Je Discord-sessie is ongeldig of verlopen." }, 401);
  }

  const identity = data.user.identities?.find((item) => item.provider === "discord");
  const discordId = String(
    identity?.identity_data?.sub
      ?? identity?.identity_data?.provider_id
      ?? identity?.identity_data?.id
      ?? data.user.user_metadata?.provider_id
      ?? data.user.user_metadata?.sub
      ?? data.user.user_metadata?.id
      ?? "",
  );
  if (!/^\d{17,20}$/.test(discordId)) {
    console.error("Authenticated Supabase user has no valid Discord identity.");
    return jsonResponse({ authorized: false, error: "Het Discord-account kon niet worden gecontroleerd." }, 403);
  }

  let discordResponse: Response;
  try {
    discordResponse = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordId)}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
  } catch {
    return jsonResponse({ authorized: false, error: "Discord is tijdelijk niet bereikbaar. Probeer het later opnieuw." }, 502);
  }
  if (discordResponse.status === 404) {
    return jsonResponse({ authorized: false, error: "Je moet lid zijn van de gekoppelde Discord-server." }, 403);
  }
  if (discordResponse.status === 401 || discordResponse.status === 403) {
    console.error("Discord rejected the bot membership check.");
    return jsonResponse({ authorized: false, error: "De Discord-servercontrole is niet beschikbaar." }, 502);
  }
  if (!discordResponse.ok) {
    console.error(`Discord membership check failed with status ${discordResponse.status}.`);
    return jsonResponse({ authorized: false, error: "De Discord-servercontrole is tijdelijk mislukt." }, 502);
  }

  return jsonResponse({ authorized: true });
});
