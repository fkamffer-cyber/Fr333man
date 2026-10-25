import { rejectCrossOrigin } from "@/lib/http";
import { authenticatedSupabase } from "@/lib/supabase-server";

const accepted = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const verificationTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const auth = await authenticatedSupabase(req);
    if (!auth) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "File required" }, { status: 400 });
    }
    if (file.size > 8_000_000) {
      return Response.json({ error: "File must be under 8 MB" }, { status: 413 });
    }
    if (!accepted.has(file.type)) {
      return Response.json(
        { error: "Use a PDF, image, CSV or Excel workbook" },
        { status: 415 },
      );
    }
    const purpose = String(form.get("purpose") || "credential");
    const folder =
      purpose === "identity"
        ? "identity"
        : purpose === "witness-selfie"
          ? "witness-selfie"
          : "credentials";
    if (purpose === "identity" && !verificationTypes.has(file.type)) {
      return Response.json(
        { error: "Identity evidence must be a PDF, JPEG, PNG or WebP file" },
        { status: 415 },
      );
    }
    if (purpose === "witness-selfie" && !file.type.startsWith("image/")) {
      return Response.json(
        { error: "The joint witness selfie must be a JPEG, PNG or WebP image" },
        { status: 415 },
      );
    }
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "upload";
    const key = `${auth.user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await auth.client.storage
      .from("private-vault")
      .upload(key, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return Response.json({ ok: true, key, name: file.name, purpose });
  } catch {
    return Response.json(
      { error: "Secure upload is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const auth = await authenticatedSupabase(req);
    if (!auth) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = (await req.json()) as { keys?: unknown };
    const keys = Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === "string").slice(0, 2)
      : [];
    const allowedPrefixes = [
      `${auth.user.id}/identity/`,
      `${auth.user.id}/witness-selfie/`,
    ];
    if (
      !keys.length ||
      keys.some(
        (key) =>
          key.includes("../") ||
          key.includes("\\") ||
          !allowedPrefixes.some((prefix) =>
            key.startsWith(prefix) && key.length > prefix.length,
          ),
      )
    ) {
      return Response.json(
        { error: "Only this account's verification uploads can be removed" },
        { status: 400 },
      );
    }
    const { error } = await auth.client.storage.from("private-vault").remove(keys);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Secure upload cleanup is temporarily unavailable" },
      { status: 503 },
    );
  }
}
