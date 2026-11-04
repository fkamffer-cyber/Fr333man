export type PortableInvitationData = {
  name: string;
  message: string;
  sourceUrl: string;
  source: string;
  description: string;
  image: string;
  claimed?: boolean;
};

export function encodePortableInvitation(data: PortableInvitationData) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodePortableInvitation(
  encoded: string,
): Partial<PortableInvitationData> | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
    const data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Partial<PortableInvitationData>)
      : null;
  } catch {
    return null;
  }
}

export function portableInvitationPath(data: PortableInvitationData) {
  return `/invite/draft#data=${encodePortableInvitation(data)}`;
}
