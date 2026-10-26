import {
  authenticatedSupabase,
  publicSupabase,
  serviceSupabase,
} from "@/lib/supabase-server";
import { rejectCrossOrigin } from "@/lib/http";

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const handlePattern = /^[a-zA-Z0-9._-]{3,40}$/;
const profileFields =
  "user_id,avatar_name,display_name,region,bio,avatar_url,banner_url,skills,website_url,member_type,trust_status,platform_role,is_public,created_at";
const unavailable = () =>
  Response.json(
    { error: "People profiles are temporarily unavailable" },
    { status: 503 },
  );

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mine = url.searchParams.get("mine") === "true";
    const handle = text(url.searchParams.get("handle"), 40).replace(/^@/, "");
    if (mine) {
      const auth = await authenticatedSupabase(req);
      if (!auth) {
        return Response.json(
          { error: "Sign in to open your profile" },
          { status: 401 },
        );
      }
      const admin = serviceSupabase();
      const [profileResult, submissionResult] = await Promise.all([
        admin
          .from("profiles")
          .select(profileFields)
          .eq("user_id", auth.user.id)
          .maybeSingle(),
        admin
          .from("onboarding_submissions")
          .select("profile_public_after_approval")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
      ]);
      if (profileResult.error || submissionResult.error) throw new Error();
      return Response.json({
        profile: profileResult.data
          ? {
              ...profileResult.data,
              publish_after_approval:
                submissionResult.data?.profile_public_after_approval ??
                profileResult.data.is_public,
            }
          : null,
      });
    }
    let query = publicSupabase()
      .from("profiles")
      .select(profileFields)
      .eq("is_public", true)
      .eq("trust_status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);
    if (handle) query = query.eq("avatar_name", handle);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ profiles: data ?? [] });
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
      return Response.json(
        { error: "Sign in before editing your profile" },
        { status: 401 },
      );
    }
    const body = (await req.json()) as Record<string, unknown>;
    const admin = serviceSupabase();
    const { data: existing, error: readError } = await admin
      .from("profiles")
      .select("avatar_name,trust_status")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) {
      return Response.json(
        { error: "Complete onboarding before editing your profile" },
        { status: 409 },
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.avatarName !== undefined) {
      const avatar = text(body.avatarName, 40);
      if (!handlePattern.test(avatar)) {
        return Response.json(
          {
            error:
              "Use 3–40 letters, numbers, dots, dashes or underscores for the avatar name",
          },
          { status: 400 },
        );
      }
      updates.avatar_name = avatar;
    }
    if (body.displayName !== undefined)
      updates.display_name = text(body.displayName, 100);
    if (body.region !== undefined)
      updates.region = text(body.region, 100) || "Randburg";
    if (body.bio !== undefined) updates.bio = text(body.bio, 1600);
    if (body.avatarUrl !== undefined)
      updates.avatar_url = text(body.avatarUrl, 2048) || null;
    if (body.bannerUrl !== undefined)
      updates.banner_url = text(body.bannerUrl, 2048) || null;
    if (body.websiteUrl !== undefined)
      updates.website_url = text(body.websiteUrl, 2048) || null;
    if (body.skills !== undefined) {
      updates.skills = Array.isArray(body.skills)
        ? body.skills
            .map((item) => text(item, 60))
            .filter(Boolean)
            .slice(0, 20)
        : [];
    }

    const requestedVisibility =
      body.isPublic === undefined ? undefined : Boolean(body.isPublic);
    if (requestedVisibility !== undefined) {
      updates.is_public =
        existing.trust_status === "approved" ? requestedVisibility : false;
    }

    const { data, error } = await admin
      .from("profiles")
      .update(updates)
      .eq("user_id", auth.user.id)
      .select(profileFields)
      .single();
    if (error) throw error;

    if (requestedVisibility !== undefined) {
      const { error: preferenceError } = await admin
        .from("onboarding_submissions")
        .update({
          profile_public_after_approval: requestedVisibility,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.user.id);
      if (preferenceError) throw preferenceError;
    }

    return Response.json({
      ok: true,
      profile: {
        ...data,
        publish_after_approval: requestedVisibility ?? data.is_public,
      },
    });
  } catch {
    return unavailable();
  }
}
