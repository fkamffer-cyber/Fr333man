import { rejectCrossOrigin } from "@/lib/http";
import { invitationImageError } from "@/lib/invitation-media";
import { authenticatedSupabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const auth = await authenticatedSupabase(req);
    if (!auth)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: "Profile image required" }, { status: 400 });
    const validationError = invitationImageError(file);
    if (validationError)
      return Response.json(
        { error: validationError },
        { status: validationError.includes("8 MB") ? 413 : 415 },
      );
    const extension =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${auth.user.id}/invitations/${crypto.randomUUID()}.${extension}`;
    const { error } = await auth.client.storage
      .from("product-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = auth.client.storage.from("product-media").getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Invitation image upload is temporarily unavailable" },
      { status: 503 },
    );
  }
}
