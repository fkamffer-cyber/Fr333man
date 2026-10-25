import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");

if (!process.argv.includes("--live")) {
  throw new Error("Pass --live to run the live onboarding QA check");
}

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
const witnessHandle = `qa-witness-${runId}`;
const applicantHandle = `qa-applicant-${runId}`;
const password = `${crypto.randomUUID()}aA1!`;
const identityPath = { value: "" };
const selfiePath = { value: "" };
let witnessId = "";
let applicantId = "";
let testPassed = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoError(result, label) {
  if (result.error) {
    const diagnostic = {
      message: result.error.message || "",
      code: result.error.code || "",
      details: result.error.details || "",
      hint: result.error.hint || "",
      name: result.error.name || "",
    };
    throw new Error(`${label}: ${JSON.stringify(diagnostic)}`);
  }
  return result.data;
}

async function createQaUser(label) {
  const result = await admin.auth.admin.createUser({
    email: `${label}-${runId}@example.invalid`,
    password,
    email_confirm: true,
  });
  return assertNoError(result, `Create ${label} user`).user;
}

async function cleanup() {
  const failures = [];
  const attempt = async (label, action) => {
    try {
      const result = await action();
      if (result?.error) failures.push(`${label}: ${result.error.message}`);
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (witnessId) {
    await attempt("Delete QA audit", () =>
      admin
        .from("admin_audit")
        .delete()
        .eq("actor_id", witnessId)
        .eq("target_id", `@${applicantHandle}`),
    );
  }
  const storagePaths = [identityPath.value, selfiePath.value].filter(Boolean);
  if (storagePaths.length) {
    await attempt("Delete QA uploads", () =>
      admin.storage.from("private-vault").remove(storagePaths),
    );
  }
  if (applicantId) {
    await attempt("Delete QA applicant", () =>
      admin.auth.admin.deleteUser(applicantId),
    );
  }
  if (witnessId) {
    await attempt("Delete QA witness", () =>
      admin.auth.admin.deleteUser(witnessId),
    );
  }
  if (failures.length) {
    throw new Error(`QA cleanup failed: ${failures.join(" | ")}`);
  }
}

try {
  const serviceProbe = await fetch(`${url}/rest/v1/profiles?select=user_id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const serviceProbeBody = await serviceProbe.text();
  if (!serviceProbe.ok) {
    throw new Error(
      `Service-role REST probe failed (${serviceProbe.status}): ${serviceProbeBody.slice(0, 1000)}`,
    );
  }
  for (const table of [
    "profiles",
    "onboarding_submissions",
    "shops",
    "community_records",
    "admin_audit",
  ]) {
    const result = await admin.from(table).select("*", { count: "exact", head: true });
    assertNoError(result, `Service-role access to ${table}`);
  }
  console.log("PASS service-role table grants");

  const witness = await createQaUser("witness");
  witnessId = witness.id;
  assertNoError(
    await admin.from("profiles").insert({
      user_id: witnessId,
      avatar_name: witnessHandle,
      display_name: "QA Witness",
      region: "Randburg",
      member_type: "administration",
      trust_status: "approved",
      platform_role: "steward",
      is_public: false,
    }),
    "Create approved QA witness",
  );

  const applicant = await createQaUser("applicant");
  applicantId = applicant.id;
  identityPath.value = `${applicantId}/identity/${runId}-identity.png`;
  selfiePath.value = `${applicantId}/witness-selfie/${runId}-selfie.png`;
  const onePixelPng = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrjQAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  assertNoError(
    await admin.storage.from("private-vault").upload(identityPath.value, onePixelPng, {
      contentType: "image/png",
      upsert: false,
    }),
    "Upload QA identity evidence",
  );
  assertNoError(
    await admin.storage.from("private-vault").upload(selfiePath.value, onePixelPng, {
      contentType: "image/png",
      upsert: false,
    }),
    "Upload QA joint selfie",
  );

  const answers = Array.from(
    { length: 10 },
    (_, index) => `QA answer ${index + 1} contains enough independent detail.`,
  );
  const baseSubmission = {
    applicant: applicantId,
    requested_avatar: applicantHandle,
    applicant_region: "Randburg",
    requested_member_type: "profile",
    free_thinking_answers: answers,
    identity_path: identityPath.value,
    selfie_path: selfiePath.value,
    identity_consent: true,
    witness_consent: true,
    accepted_terms: true,
    accepted_privacy: true,
    acknowledged_fee: true,
    invitation_id: null,
  };

  const rejected = await admin.rpc("submit_people_onboarding", {
    ...baseSubmission,
    witness_handle: `missing-${runId}`,
  });
  assert(rejected.error, "Unknown witness was incorrectly accepted");
  assert(
    rejected.error.message.includes("existing approved People member"),
    "Unknown witness returned the wrong validation error",
  );
  const rolledBackProfile = assertNoError(
    await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", applicantId)
      .maybeSingle(),
    "Check rejected onboarding rollback",
  );
  assert(!rolledBackProfile, "Rejected onboarding left a partial profile behind");
  console.log("PASS rejected onboarding rolls back atomically");

  const submitted = assertNoError(
    await admin.rpc("submit_people_onboarding", {
      ...baseSubmission,
      witness_handle: `@${witnessHandle}`,
    }),
    "Submit valid onboarding",
  );
  assert(submitted.status === "pending_identity_review", "Wrong submitted status");

  const pendingProfile = assertNoError(
    await admin
      .from("profiles")
      .select("trust_status,is_public")
      .eq("user_id", applicantId)
      .single(),
    "Read pending profile",
  );
  const pendingSubmission = assertNoError(
    await admin
      .from("onboarding_submissions")
      .select("status,witness_user_id,welcome_post_id")
      .eq("user_id", applicantId)
      .single(),
    "Read pending submission",
  );
  const pendingShop = assertNoError(
    await admin.from("shops").select("status").eq("owner_id", applicantId).single(),
    "Read draft shop",
  );
  assert(
    pendingProfile.trust_status === "pending_review" && pendingProfile.is_public === false,
    "Pending profile became public before review",
  );
  assert(
    pendingSubmission.status === "pending_identity_review" &&
      pendingSubmission.witness_user_id === witnessId &&
      pendingSubmission.welcome_post_id === null,
    "Pending submission state is inconsistent",
  );
  assert(pendingShop.status === "draft", "Shop activated before approval");
  console.log("PASS valid onboarding is pending and private");

  const approval = assertNoError(
    await admin.rpc("approve_people_member", {
      target_handle: `@${applicantHandle}`,
      reviewer: witnessId,
    }),
    "Approve People member",
  );
  assert(approval.status === "approved", "Approval returned the wrong status");

  const approvedProfile = assertNoError(
    await admin
      .from("profiles")
      .select("trust_status,is_public")
      .eq("user_id", applicantId)
      .single(),
    "Read approved profile",
  );
  const approvedSubmission = assertNoError(
    await admin
      .from("onboarding_submissions")
      .select(
        "status,identity_document_verified_at,witness_selfie_verified_at,verified_at,welcome_post_id",
      )
      .eq("user_id", applicantId)
      .single(),
    "Read approved submission",
  );
  const activeShop = assertNoError(
    await admin.from("shops").select("slug,status").eq("owner_id", applicantId).single(),
    "Read active shop",
  );
  const welcomePost = assertNoError(
    await admin
      .from("community_records")
      .select("id,title,data,status")
      .eq("id", approvedSubmission.welcome_post_id)
      .single(),
    "Read welcome Feed post",
  );
  const { count: auditCount, error: auditError } = await admin
    .from("admin_audit")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", witnessId)
    .eq("target_id", `@${applicantHandle}`)
    .eq("action", "member-status");
  assertNoError({ data: null, error: auditError }, "Read approval audit");
  assert(approvedProfile.trust_status === "approved" && approvedProfile.is_public, "Approved profile is not public");
  assert(
    approvedSubmission.status === "approved" &&
      approvedSubmission.identity_document_verified_at &&
      approvedSubmission.witness_selfie_verified_at &&
      approvedSubmission.verified_at,
    "Approval timestamps were not stored",
  );
  assert(activeShop.status === "active", "Approved member shop is not active");
  assert(
    welcomePost.status === "active" &&
      welcomePost.data?.kind === "member_welcome" &&
      welcomePost.data?.profileUrl === `/people/${applicantHandle}` &&
      welcomePost.data?.shopUrl === `/shops/${activeShop.slug}` &&
      !String(welcomePost.data?.body || "").toLowerCase().includes("liveness"),
    "Welcome Feed post is missing truthful profile/shop links",
  );
  assert(auditCount === 1, "Approval did not write exactly one audit record");

  const publicProfile = assertNoError(
    await publicClient
      .from("profiles")
      .select("avatar_name")
      .eq("user_id", applicantId)
      .single(),
    "Read approved profile through public RLS",
  );
  const publicWelcome = assertNoError(
    await publicClient
      .from("community_records")
      .select("id")
      .eq("id", welcomePost.id)
      .single(),
    "Read welcome post through public RLS",
  );
  assert(publicProfile.avatar_name === applicantHandle && publicWelcome.id === welcomePost.id, "Public People/Feed records are unavailable");

  const secondApproval = assertNoError(
    await admin.rpc("approve_people_member", {
      target_handle: applicantHandle,
      reviewer: witnessId,
    }),
    "Repeat approval",
  );
  const { count: repeatedAuditCount, error: repeatedAuditError } = await admin
    .from("admin_audit")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", witnessId)
    .eq("target_id", `@${applicantHandle}`)
    .eq("action", "member-status");
  assertNoError({ data: null, error: repeatedAuditError }, "Read repeated approval audit");
  assert(
    secondApproval.welcomePostId === approvedSubmission.welcome_post_id &&
      repeatedAuditCount === 1,
    "Repeated approval created duplicate welcome or audit records",
  );
  console.log("PASS approval atomically activates profile/shop and creates one welcome Feed post");
  console.log("PASS public RLS and idempotent approval");
  testPassed = true;
} finally {
  await cleanup();
  console.log("PASS temporary QA data removed");
}

if (!testPassed) process.exitCode = 1;
