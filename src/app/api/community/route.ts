import { authenticatedSupabase, publicSupabase, serviceSupabase } from "@/lib/supabase-server";
import { rejectCrossOrigin } from "@/lib/http";

const contentEntities = new Set([
  "post",
  "project",
  "task",
  "product",
  "promotion",
  "support",
  "consent",
  "dispute",
  "broadcast",
]);
const statuses = new Set(["draft", "active", "pending_review", "archived"]);

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function unavailable() {
  return Response.json(
    { error: "Community storage is temporarily unavailable" },
    { status: 503 },
  );
}

function verificationPath(
  userId: string,
  folder: "identity" | "witness-selfie",
  value: unknown,
) {
  const path = text(value, 500);
  const prefix = `${userId}/${folder}/`;
  if (
    !path.startsWith(prefix) ||
    path.length <= prefix.length ||
    path.includes("../") ||
    path.includes("\\")
  ) {
    return "";
  }
  return path;
}

async function removeVerificationFiles(
  admin: ReturnType<typeof serviceSupabase>,
  paths: string[],
) {
  if (!paths.length) return;
  await admin.storage.from("private-vault").remove(paths);
}

function onboardingFailure(error: { message?: string; code?: string } | null) {
  const message = error?.message || "";
  const clientErrors = [
    "Authenticated People account not found",
    "Choose a 3-40 character avatar name using letters, numbers, dots, dashes or underscores",
    "Region must be 80 characters or fewer",
    "Choose a valid membership path",
    "Complete all 10 free-thinking answers with at least 10 characters each",
    "All identity, witness, terms, privacy and fee acknowledgements are required",
    "The identity upload does not belong to this People account",
    "The joint selfie does not belong to this People account",
    "Verification upload is missing; upload both files again",
  ];
  const conflictErrors = [
    "The witness must be an existing approved People member",
    "A different approved People member must witness this account",
    "This People membership has already been approved",
    "This avatar name is already in use",
    "This invitation is invalid, expired or already claimed",
  ];
  const clientMessage = clientErrors.find((item) => message.includes(item));
  if (clientMessage) return Response.json({ error: clientMessage }, { status: 400 });
  const conflictMessage = conflictErrors.find((item) => message.includes(item));
  if (conflictMessage) return Response.json({ error: conflictMessage }, { status: 409 });
  if (error?.code === "23505") {
    return Response.json(
      { error: "This avatar name is already in use" },
      { status: 409 },
    );
  }
  return unavailable();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return Response.json({ error: "Invitation not found" }, { status: 404 });
      }
      const { data, error } = await serviceSupabase()
        .from("invitations")
        .select(
          "id,recipient_name,personal_message,source_url,source_metadata,status,expires_at",
        )
        .eq("id", id)
        .eq("status", "unclaimed")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !data) {
        return Response.json({ error: "Invitation not found" }, { status: 404 });
      }
      return Response.json({
        records: [
          {
            id: data.id,
            entity: "invitation",
            title: data.recipient_name,
            data: {
              name: data.recipient_name,
              message: data.personal_message,
              sourceUrl: data.source_url,
              ...(data.source_metadata as object),
            },
            status: data.status,
          },
        ],
      });
    }

    const entity = url.searchParams.get("entity");
    if (entity && !contentEntities.has(entity)) {
      return Response.json({ error: "Unsupported record type" }, { status: 400 });
    }
    const mine = url.searchParams.get("mine") === "true";
    const auth = mine ? await authenticatedSupabase(req) : null;
    if (mine && !auth) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const client = mine ? serviceSupabase() : publicSupabase();
    let query = client
      .from("community_records")
      .select("id,owner_id,entity,title,data,status,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (entity) query = query.eq("entity", entity);
    if (mine && auth) query = query.eq("owner_id", auth.user.id);
    const { data, error } = await query;
    if (error) throw error;
    const ownerIds = Array.from(new Set((data ?? []).map((row) => row.owner_id)));
    const { data: authors } = ownerIds.length
      ? await client
          .from("profiles")
          .select("user_id,avatar_name,display_name,region")
          .in("user_id", ownerIds)
      : { data: [] };
    const authorMap = new Map(
      (authors ?? []).map((author) => [author.user_id, author]),
    );
    return Response.json({
      records: (data ?? []).map((row) => ({
        ...row,
        author: authorMap.get(row.owner_id) ?? null,
      })),
    });
  } catch {
    return unavailable();
  }
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const auth = await authenticatedSupabase(req);
    if (!auth) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = (await req.json()) as {
      entity?: unknown;
      title?: unknown;
      data?: Record<string, unknown>;
      status?: unknown;
    };
    const entity = text(body.entity, 40);
    const title = text(body.title);
    const data = body.data && typeof body.data === "object" ? body.data : {};
    if (!entity || !title) {
      return Response.json(
        { error: "Record type and title are required" },
        { status: 400 },
      );
    }
    const admin = serviceSupabase();

    if (entity === "profile") {
      const avatar = text(data.avatar, 40);
      const region = text(data.region, 80) || "Randburg";
      if (!/^[a-zA-Z0-9._-]{3,40}$/.test(avatar)) {
        return Response.json(
          {
            error:
              "Choose a 3–40 character avatar name using letters, numbers, dots, dashes or underscores",
          },
          { status: 400 },
        );
      }
      const memberType = ["profile", "project", "administration"].includes(
        String(data.memberType),
      )
        ? String(data.memberType)
        : "profile";
      const answers = Array.isArray(data.answers)
        ? data.answers.slice(0, 10).map((answer) => text(answer, 2000))
        : [];
      if (answers.length !== 10 || answers.some((answer) => answer.length < 10)) {
        return Response.json(
          {
            error:
              "Complete all 10 free-thinking answers with at least 10 characters each",
          },
          { status: 400 },
        );
      }
      if (
        data.identityConsent !== true ||
        data.witnessConsent !== true ||
        data.terms !== true ||
        data.privacy !== true ||
        data.fee !== true
      ) {
        return Response.json(
          {
            error:
              "All identity, witness, terms, privacy and fee acknowledgements are required",
          },
          { status: 400 },
        );
      }
      const witness = text(data.witness, 80);
      if (!/^@?[a-zA-Z0-9._-]{3,40}$/.test(witness)) {
        return Response.json(
          { error: "Enter the handle of an existing approved People member" },
          { status: 400 },
        );
      }
      const identityDocumentPath = verificationPath(
        auth.user.id,
        "identity",
        data.identityDocumentPath,
      );
      const witnessSelfiePath = verificationPath(
        auth.user.id,
        "witness-selfie",
        data.witnessSelfiePath,
      );
      if (!identityDocumentPath || !witnessSelfiePath) {
        return Response.json(
          {
            error:
              "Identity evidence and a joint member-witness selfie uploaded by this account are required",
          },
          { status: 400 },
        );
      }
      const rawInviteId =
        typeof data.inviteId === "string" ? data.inviteId.trim() : "";
      if (rawInviteId && !/^[0-9a-f-]{36}$/i.test(rawInviteId)) {
        return Response.json(
          { error: "This invitation link is invalid" },
          { status: 400 },
        );
      }

      const { data: previous, error: previousError } = await admin
        .from("onboarding_submissions")
        .select("identity_document_path,witness_selfie_path")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      const submittedPaths = [identityDocumentPath, witnessSelfiePath];
      const previousPaths = new Set(
        [previous?.identity_document_path, previous?.witness_selfie_path].filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
      );
      const newlyUploadedPaths = submittedPaths.filter(
        (path) => !previousPaths.has(path),
      );
      if (previousError) {
        await removeVerificationFiles(admin, newlyUploadedPaths);
        return unavailable();
      }

      const { error } = await admin.rpc("submit_people_onboarding", {
        applicant: auth.user.id,
        requested_avatar: avatar,
        applicant_region: region,
        requested_member_type: memberType,
        free_thinking_answers: answers,
        witness_handle: witness,
        identity_path: identityDocumentPath,
        selfie_path: witnessSelfiePath,
        identity_consent: true,
        witness_consent: true,
        accepted_terms: true,
        accepted_privacy: true,
        acknowledged_fee: true,
        invitation_id: rawInviteId || null,
      });
      if (error) {
        await removeVerificationFiles(admin, newlyUploadedPaths);
        return onboardingFailure(error);
      }

      const replacedPaths = Array.from(previousPaths).filter(
        (path) => !submittedPaths.includes(path),
      );
      await removeVerificationFiles(admin, replacedPaths);
      return Response.json({
        ok: true,
        id: auth.user.id,
        status: "pending_identity_review",
      });
    }

    if (entity === "invitation") {
      const name = text(data.name || title, 120);
      const message = text(data.message, 500);
      const sourceUrl = text(data.sourceUrl, 2048);
      try {
        const parsed = new URL(sourceUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        return Response.json(
          { error: "A valid public source URL is required" },
          { status: 400 },
        );
      }
      if (!name || !message) {
        return Response.json(
          { error: "Recipient name and personal message are required" },
          { status: 400 },
        );
      }
      const metadata = {
        source: text(data.source, 40),
        description: text(data.description, 500),
        image: text(data.image, 2048),
        claimed: false,
      };
      const { data: created, error } = await admin
        .from("invitations")
        .insert({
          inviter_id: auth.user.id,
          recipient_name: name,
          personal_message: message,
          source_url: sourceUrl,
          source_metadata: metadata,
        })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ ok: true, id: created.id });
    }

    if (!contentEntities.has(entity)) {
      return Response.json({ error: "Unsupported record type" }, { status: 400 });
    }
    const status = statuses.has(String(body.status))
      ? String(body.status)
      : "active";
    const { data: created, error } = await admin
      .from("community_records")
      .insert({ entity, owner_id: auth.user.id, title, data, status })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ ok: true, id: created.id });
  } catch {
    return unavailable();
  }
}

export async function PATCH(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const auth = await authenticatedSupabase(req);
    if (!auth) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = (await req.json()) as {
      id?: unknown;
      title?: unknown;
      data?: Record<string, unknown>;
      status?: unknown;
    };
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return Response.json({ error: "Valid record id required" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = text(body.title);
    if (body.data && typeof body.data === "object") updates.data = body.data;
    if (body.status !== undefined && statuses.has(String(body.status))) {
      updates.status = String(body.status);
    }
    const { data, error } = await serviceSupabase()
      .from("community_records")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", auth.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json({ ok: true, id: data.id });
  } catch {
    return unavailable();
  }
}
