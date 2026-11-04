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

export function inferredInvitationName(value: string, source: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const facebookHandle =
      source === "Facebook" &&
      segments[0] &&
      ![
        "about",
        "business",
        "events",
        "friends",
        "groups",
        "help",
        "home.php",
        "login",
        "login.php",
        "marketplace",
        "messages",
        "people",
        "photo",
        "photos",
        "profile.php",
        "reel",
        "reels",
        "share",
        "stories",
        "watch",
      ].includes(segments[0].toLowerCase())
        ? segments[0]
        : "";
    const linkedInHandle =
      source === "LinkedIn" &&
      ["in", "company", "school"].includes(segments[0]?.toLowerCase())
        ? segments[1] || ""
        : "";
    const segment = facebookHandle || linkedInHandle || segments.at(-1) || "";
    const readable = segment.replace(/[-_.]+/g, " ").trim();
    return readable || `${source} profile`;
  } catch {
    return `${source} profile`;
  }
}
