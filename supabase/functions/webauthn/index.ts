import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@10.0.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@10.0.1/helpers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const RP_NAME = "Kera AI";

function getRpId(req: Request): string {
  const origin = req.headers.get("origin") || "";
  try {
    const url = new URL(origin);
    return url.hostname; // localhost, chat.kera.ia.br, etc
  } catch {
    return "localhost";
  }
}

function getOrigin(req: Request): string {
  return req.headers.get("origin") || "";
}

async function getUserFromAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function saveChallenge(params: {
  user_id?: string | null;
  email?: string | null;
  challenge: string;
  type: "registration" | "authentication";
}) {
  // limpa anteriores do mesmo escopo
  if (params.user_id) {
    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", params.user_id)
      .eq("type", params.type);
  } else if (params.email) {
    await admin
      .from("webauthn_challenges")
      .delete()
      .eq("email", params.email)
      .eq("type", params.type);
  }
  const { error } = await admin.from("webauthn_challenges").insert({
    user_id: params.user_id ?? null,
    email: params.email ?? null,
    challenge: params.challenge,
    type: params.type,
  });
  if (error) throw error;
}

async function popChallenge(params: {
  user_id?: string | null;
  email?: string | null;
  type: "registration" | "authentication";
}): Promise<string | null> {
  let query = admin
    .from("webauthn_challenges")
    .select("id, challenge, expires_at")
    .eq("type", params.type)
    .order("created_at", { ascending: false })
    .limit(1);
  if (params.user_id) query = query.eq("user_id", params.user_id);
  else if (params.email) query = query.eq("email", params.email);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from("webauthn_challenges").delete().eq("id", data.id);
    return null;
  }
  await admin.from("webauthn_challenges").delete().eq("id", data.id);
  return data.challenge;
}

// ---------- Handlers ----------

async function handleRegisterOptions(req: Request) {
  const user = await getUserFromAuth(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  const { data: existing } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const rpID = getRpId(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: (user.user_metadata?.display_name as string) ?? user.email ?? "Kera User",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform", // Face ID / Touch ID / Windows Hello
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransport[] | null) ?? undefined,
    })),
  });

  await saveChallenge({
    user_id: user.id,
    challenge: options.challenge,
    type: "registration",
  });

  return json({ options });
}

async function handleRegisterVerify(req: Request) {
  const user = await getUserFromAuth(req);
  if (!user) return json({ error: "Não autenticado" }, 401);

  const body = await req.json();
  const response = body?.response;
  const deviceLabel = (body?.device_label as string) || "Passkey";
  if (!response) return json({ error: "Resposta ausente" }, 400);

  const expectedChallenge = await popChallenge({
    user_id: user.id,
    type: "registration",
  });
  if (!expectedChallenge) return json({ error: "Desafio expirado" }, 400);

  const rpID = getRpId(req);
  const origin = getOrigin(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return json({ error: "Verificação falhou" }, 400);
  }

  const { credential } = verification.registrationInfo;
  const credIdB64 = credential.id; // já base64url string
  const pubKeyB64 = isoBase64URL.fromBuffer(credential.publicKey);

  const { error } = await admin.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credIdB64,
    public_key: pubKeyB64,
    counter: credential.counter ?? 0,
    transports: response?.response?.transports ?? null,
    device_label: deviceLabel,
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}

async function handleAuthOptions(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  if (!email) return json({ error: "Email obrigatório" }, 400);

  // procura usuário pelo email
  const { data: userList } = await admin.auth.admin.listUsers();
  const found = userList?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (!found) {
    // não revela existência
    return json({ error: "Sem passkey cadastrado" }, 404);
  }

  const { data: creds } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", found.id);

  if (!creds || creds.length === 0) {
    return json({ error: "Sem passkey cadastrado" }, 404);
  }

  const rpID = getRpId(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransport[] | null) ?? undefined,
    })),
  });

  await saveChallenge({
    email,
    challenge: options.challenge,
    type: "authentication",
  });

  return json({ options });
}

async function handleAuthVerify(req: Request) {
  const body = await req.json();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const response = body?.response;
  if (!email || !response) return json({ error: "Dados incompletos" }, 400);

  const expectedChallenge = await popChallenge({
    email,
    type: "authentication",
  });
  if (!expectedChallenge) return json({ error: "Desafio expirado" }, 400);

  const credentialId: string = response?.id;
  if (!credentialId) return json({ error: "credential id ausente" }, 400);

  const { data: cred } = await admin
    .from("webauthn_credentials")
    .select("id, user_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (!cred) return json({ error: "Passkey não encontrado" }, 404);

  const rpID = getRpId(req);
  const origin = getOrigin(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialId,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: Number(cred.counter ?? 0),
        transports: (cred.transports as AuthenticatorTransport[] | null) ?? undefined,
      },
      requireUserVerification: false,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  if (!verification.verified) return json({ error: "Verificação falhou" }, 400);

  // confere email do usuário
  const { data: userInfo } = await admin.auth.admin.getUserById(cred.user_id);
  if (!userInfo?.user || (userInfo.user.email ?? "").toLowerCase() !== email) {
    return json({ error: "Passkey não confere com o email" }, 400);
  }

  // atualiza contador
  await admin
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  return json({ ok: true, user_id: cred.user_id });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const url = new URL(req.url);
  // path: /webauthn/<action>
  const action = url.pathname.split("/").filter(Boolean).pop();

  try {
    switch (action) {
      case "register-options":
        return await handleRegisterOptions(req);
      case "register-verify":
        return await handleRegisterVerify(req);
      case "auth-options":
        return await handleAuthOptions(req);
      case "auth-verify":
        return await handleAuthVerify(req);
      default:
        return json({ error: "Ação inválida" }, 404);
    }
  } catch (e) {
    console.error("webauthn error", e);
    return json({ error: (e as Error).message }, 500);
  }
});