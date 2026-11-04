const acceptedInvitationImages = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function invitationImageError(file: Pick<File, "size" | "type">) {
  if (file.size > 8_000_000) return "Image must be under 8 MB";
  if (!acceptedInvitationImages.has(file.type))
    return "Use a JPEG, PNG or WebP image";
  return "";
}
