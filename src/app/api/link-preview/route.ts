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
function meta(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return "";
}
function clean(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 500);
}
export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  try {
    const body = (await req.json()) as { url?: string };
    let requested = safeUrl(String(body.url || ""));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect++) {
      response = await fetch(requested, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "FR333MAN invitation preview/1.0" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect");
      requested = safeUrl(new URL(location, requested).toString());
    }
    clearTimeout(timeout);
    if (!response || !response.ok)
      throw new Error("The public page could not be read");
    const finalUrl = requested;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000)
      throw new Error("That page is too large to preview");
    const html = (await response.text()).slice(0, 500_000);
    const title = clean(
      meta(html, "og:title") ||
        meta(html, "twitter:title") ||
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
        finalUrl.hostname,
    );
    const description = clean(
      meta(html, "og:description") ||
        meta(html, "description") ||
        meta(html, "twitter:description"),
    );
    const image = meta(html, "og:image") || meta(html, "twitter:image");
    return Response.json({
      title,
      description,
      image: image
        ? safeUrl(new URL(image, finalUrl).toString()).toString()
        : "",
      url: finalUrl.toString(),
      source:
        finalUrl.hostname.includes("youtube.com") ||
        finalUrl.hostname === "youtu.be"
          ? "YouTube"
          : "Website",
    });
  } catch {
    return Response.json(
      { error: "The public page could not be previewed" },
      { status: 400 },
    );
  }
}
import { rejectCrossOrigin } from "@/lib/http";
