import { rejectCrossOrigin } from "@/lib/http";

type Preview = {
  title: string;
  description: string;
  image: string;
  url: string;
  source: string;
  limited: boolean;
  notice?: string;
};

const facebookReservedPaths = new Set([
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
]);

function sourceName(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const onDomain = (domain: string) =>
    host === domain || host.endsWith(`.${domain}`);
  if (host === "youtu.be" || onDomain("youtube.com")) return "YouTube";
  if (host === "fb.com" || onDomain("facebook.com")) return "Facebook";
  if (onDomain("linkedin.com")) return "LinkedIn";
  return "Public website";
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use a public http or https link");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^::1$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error("Private network links are not allowed");
  return url;
}

function clean(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function attribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(
      `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return clean(match?.[1] || match?.[2] || match?.[3] || "");
}

function meta(html: string, key: string) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const identity = attribute(tag, "property") || attribute(tag, "name");
    if (identity.toLowerCase() === key.toLowerCase())
      return attribute(tag, "content");
  }
  return "";
}

function fallbackTitle(url: URL, source: string) {
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const facebookHandle =
    source === "Facebook" &&
    segments[0] &&
    !facebookReservedPaths.has(segments[0].toLowerCase())
      ? segments[0]
      : "";
  const linkedInHandle =
    source === "LinkedIn" && ["in", "company", "school"].includes(segments[0])
      ? segments[1] || ""
      : "";
  const segment = facebookHandle || linkedInHandle || segments.at(-1) || "";
  const readable = segment.replace(/[-_.]+/g, " ").trim();
  return readable
    ? source === "Facebook" || source === "LinkedIn"
      ? `${readable} on ${source}`
      : readable
    : `${source} profile`;
}

function facebookPageHandle(url: URL) {
  if (sourceName(url.hostname) !== "Facebook") return "";
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return "";
  const handle = decodeURIComponent(segments[0]).trim();
  if (
    facebookReservedPaths.has(handle.toLowerCase()) ||
    !/^[a-zA-Z0-9._-]{2,100}$/.test(handle)
  )
    return "";
  return handle;
}

function remoteImage(value: string, base: URL) {
  if (!value) return "";
  try {
    return safeUrl(new URL(value, base).toString()).toString();
  } catch {
    return "";
  }
}

async function facebookPagePreview(url: URL): Promise<Preview | null> {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const handle = facebookPageHandle(url);
  if (!accessToken || !handle) return null;
  try {
    const fields = new URLSearchParams({
      fields: "name,about,description,link,picture.type(large)",
    });
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${encodeURIComponent(handle)}?${fields}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return null;
    const page = (await response.json()) as {
      name?: string;
      about?: string;
      description?: string;
      picture?: { data?: { url?: string } };
    };
    const title = clean(page.name || "");
    if (!title) return null;
    const about = clean(page.about || "");
    const description = clean(page.description || "");
    const image = remoteImage(page.picture?.data?.url || "", url);
    const summary = [about, description]
      .filter(
        (value, index, values) => value && values.indexOf(value) === index,
      )
      .join(" — ");
    return {
      title,
      description: summary,
      image,
      url: url.toString(),
      source: "Facebook",
      limited: !image || (!about && !description),
      notice:
        !image || !summary
          ? "Facebook supplied only part of this public Page. Confirm the source and complete the missing fields before inviting."
          : undefined,
    };
  } catch {
    return null;
  }
}

function limitedPreview(requested: URL, source: string): Preview {
  return {
    title: fallbackTitle(requested, source),
    description: "",
    image: "",
    url: requested.toString(),
    source,
    limited: true,
    notice:
      source === "Facebook"
        ? "Facebook did not expose this page's image or biography. Confirm the name and add only public, source-checked details before sending."
        : source === "LinkedIn"
          ? "LinkedIn did not expose this person's image or biography. LinkedIn account access can return only the profile of the person who consents and signs in, not another member's profile."
        : `${source} limits automatic public previews. Review the source and complete the profile details before sending.`,
  };
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  let fallback: { requested: URL; source: string } | null = null;
  try {
    const body = (await req.json()) as { url?: string };
    const original = safeUrl(String(body.url || ""));
    let requested = original;
    const requestedSource = sourceName(original.hostname);
    fallback = { requested: original, source: requestedSource };

    if (requestedSource === "Facebook") {
      const graphPreview = await facebookPagePreview(original);
      if (graphPreview) return Response.json(graphPreview);
    }

    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect++) {
      response = await fetch(requested, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-ZA,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect");
      const next = safeUrl(new URL(location, requested).toString());
      const restrictedRedirect =
        (requestedSource === "Facebook" &&
          next.pathname.toLowerCase().startsWith("/login")) ||
        (requestedSource === "LinkedIn" &&
          /\/(?:authwall|login|uas\/login)/i.test(next.pathname));
      if (restrictedRedirect)
        return Response.json(limitedPreview(original, requestedSource));
      requested = next;
    }
    if (!response || !response.ok) {
      if (["Facebook", "LinkedIn"].includes(requestedSource))
        return Response.json(limitedPreview(original, requestedSource));
      throw new Error("The public page could not be read");
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000)
      throw new Error("That page is too large to preview");
    const html = (await response.text()).slice(0, 500_000);
    const htmlTitle = clean(
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "",
    );
    const title = clean(
      meta(html, "og:title") ||
        meta(html, "twitter:title") ||
        htmlTitle ||
        requested.hostname,
    );
    const description = clean(
      meta(html, "og:description") ||
        meta(html, "description") ||
        meta(html, "twitter:description"),
    );
    const image = remoteImage(
      meta(html, "og:image:secure_url") ||
        meta(html, "og:image") ||
        meta(html, "twitter:image"),
      requested,
    );
    const restrictedPage =
      (requestedSource === "Facebook" &&
        (!image ||
          /(?:log in|sign up|facebook)$/i.test(title) ||
          /temporarily blocked/i.test(`${title} ${description}`))) ||
      (requestedSource === "LinkedIn" &&
        /(?:authwall|sign in|join linkedin|linkedin login)/i.test(
          `${title} ${description}`,
        ));
    if (restrictedPage) {
      const limited = limitedPreview(original, requestedSource);
      return Response.json({
        ...limited,
        title:
          title &&
          !/(?:log in|sign up|facebook|authwall|join linkedin|linkedin login)$/i.test(
            title,
          )
            ? title
            : limited.title,
        description,
        image,
      });
    }
    return Response.json({
      title,
      description,
      image,
      url: requested.toString(),
      source: sourceName(requested.hostname),
      limited: !title || (!description && !image),
    } satisfies Preview);
  } catch {
    if (fallback && ["Facebook", "LinkedIn"].includes(fallback.source))
      return Response.json(limitedPreview(fallback.requested, fallback.source));
    return Response.json(
      { error: "The public page could not be previewed" },
      { status: 400 },
    );
  }
}
