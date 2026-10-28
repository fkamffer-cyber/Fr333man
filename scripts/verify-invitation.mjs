import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");

if (!process.argv.includes("--live")) {
  throw new Error("Pass --live to run the invitation API QA check");
}

const baseIndex = process.argv.indexOf("--base-url");
const baseUrl = new URL(
  baseIndex >= 0 && process.argv[baseIndex + 1]
    ? process.argv[baseIndex + 1]
    : "http://localhost:3001",
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !publicKey) {
  throw new Error("Supabase environment variables are incomplete");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const email = `qa-inviter-${runId}@example.invalid`;
const password = `${crypto.randomUUID()}aA1!`;
let userId = "";
let invitationId = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`Create QA inviter: ${created.error?.message || "failed"}`);
  }
  userId = created.data.user.id;
  const signedIn = await publicClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(`Sign in QA inviter: ${signedIn.error?.message || "failed"}`);
  }

  const createResponse = await fetch(new URL("/api/community", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signedIn.data.session.access_token}`,
      "Content-Type": "application/json",
      Origin: baseUrl.origin,
    },
    body: JSON.stringify({
      entity: "invitation",
      title: "QA Invitation",
      data: {
        name: "QA Invitation",
        message: "This temporary invitation verifies the public claim flow.",
        sourceUrl: "https://www.linkedin.com/company/openai",
        source: "LinkedIn",
        description: "Temporary QA record",
        image: "",
      },
    }),
  });
  const createdInvitation = await createResponse.json();
  assert(
    createResponse.ok &&
      typeof createdInvitation.id === "string" &&
      /^[A-HJ-NP-Z2-9]{10}$/.test(String(createdInvitation.code)),
    `Invitation creation failed: ${JSON.stringify(createdInvitation)}`,
  );
  invitationId = createdInvitation.id;

  const lookupResponse = await fetch(
    new URL(`/api/community?id=${encodeURIComponent(createdInvitation.code)}`, baseUrl),
  );
  const lookup = await lookupResponse.json();
  assert(
    lookupResponse.ok && lookup.records?.[0]?.id === invitationId,
    `Invitation code lookup failed: ${JSON.stringify(lookup)}`,
  );
  console.log("PASS invitation creation returns a public claim code");
  console.log("PASS claim code resolves to the stored invitation UUID");
} finally {
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) throw new Error(`QA cleanup failed: ${removed.error.message}`);
  }
  if (invitationId) {
    const remaining = await admin
      .from("invitations")
      .select("id")
      .eq("id", invitationId)
      .maybeSingle();
    if (remaining.error || remaining.data) {
      throw new Error("QA cleanup failed: temporary invitation remains");
    }
  }
  console.log("PASS temporary invitation data removed");
}
