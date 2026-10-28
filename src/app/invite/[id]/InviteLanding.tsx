"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- claim flow uses full navigation and reviewed public image hosts */
import { useEffect, useState } from "react";
import { release } from "../../release";
type Invite = {
  name?: string;
  message?: string;
  sourceUrl?: string;
  source?: string;
  description?: string;
  image?: string;
};
export default function InviteLanding({ id }: { id: string }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [invitationId, setInvitationId] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const readPortableDraft = () => {
      try {
        const encoded = new URLSearchParams(window.location.hash.slice(1)).get(
          "data",
        );
        if (!encoded) return null;
        const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
        const bytes = Uint8Array.from(atob(padded), (character) =>
          character.charCodeAt(0),
        );
        const data = JSON.parse(new TextDecoder().decode(bytes)) as Invite;
        let source = new URL(String(data.sourceUrl || ""));
        if (!["http:", "https:"].includes(source.protocol)) return null;
        const sourceHost = source.hostname.toLowerCase();
        const isFacebook =
          sourceHost === "facebook.com" || sourceHost.endsWith(".facebook.com");
        if (isFacebook && source.pathname.toLowerCase().startsWith("/login")) {
          const next = source.searchParams.get("next");
          if (next) {
            const publicPage = new URL(next);
            if (
              ["http:", "https:"].includes(publicPage.protocol) &&
              (publicPage.hostname.toLowerCase() === "facebook.com" ||
                publicPage.hostname.toLowerCase().endsWith(".facebook.com"))
            )
              source = publicPage;
          }
        }
        const facebookHandle = source.pathname.split("/").filter(Boolean)[0];
        const suppliedName = String(data.name || "").trim();
        const name =
          /^facebook(?: profile)?$/i.test(suppliedName) && facebookHandle
            ? `${decodeURIComponent(facebookHandle).replace(/[-_.]+/g, " ")} on Facebook`
            : suppliedName || "Invited person";
        return {
          name: name.slice(0, 120),
          message: String(data.message || "").slice(0, 500),
          sourceUrl: source.toString(),
          source: String(data.source || "Public website").slice(0, 30),
          description: String(data.description || "").slice(0, 500),
          image: String(data.image || "").slice(0, 2048),
        };
      } catch {
        return null;
      }
    };
    if (id === "draft") {
      const portable = readPortableDraft();
      queueMicrotask(() => {
        if (portable) setInvite(portable);
        else setMissing(true);
      });
      return;
    }
    void fetch(`/api/community?id=${encodeURIComponent(id)}`)
      .then(async (response) =>
        (await response.json()) as {
          records?: { id: string; entity: string; data: Invite }[];
        },
      )
      .then((result) => {
        const record = result.records?.[0];
        if (record?.entity === "invitation") {
          setInvite(record.data);
          setInvitationId(record.id);
        }
        else setMissing(true);
      })
      .catch(() => {
        const portable = readPortableDraft();
        if (portable) setInvite(portable);
        else setMissing(true);
      });
  }, [id]);
  if (missing)
    return (
      <main className="invite-landing">
        <h1>This invitation is not available.</h1>
        <a href="/">Return to FR333MAN</a>
      </main>
    );
  if (!invite)
    return (
      <main className="invite-landing">
        <p>Loading invitation…</p>
      </main>
    );
  const initials =
    String(invite.name || "Invited person")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const claimUrl = invitationId
    ? `/onboarding?invite=${encodeURIComponent(invitationId)}`
    : "/onboarding";
  const publicCode = /^[A-HJ-NP-Z2-9]{10}$/.test(id.toUpperCase())
    ? id.toUpperCase()
    : "";
  return (
    <main className="invite-landing">
      <nav>
        <a href="/">
          FR<span>333</span>MAN
        </a>
        <span>{release.label}</span>
        <small>UNCLAIMED PROFILE DRAFT</small>
      </nav>
      <section>
        {invite.image ? (
          <img src={invite.image} alt={`${invite.name || "Invited person"} public profile`} />
        ) : (
          <div className="invite-landing-fallback" aria-hidden="true">
            {initials}
          </div>
        )}
        <p>YOU ARE INVITED</p>
        <h1>{invite.name}</h1>
        {publicCode && <strong>Invitation code: {publicCode}</strong>}
        <blockquote>{invite.message}</blockquote>
        <p>{invite.description}</p>
        <div>
          <a href={invite.sourceUrl} target="_blank" rel="noreferrer">
            Review the public source ↗
          </a>
          <a
            className="primary"
            href={claimUrl}
          >
            Claim this profile
          </a>
        </div>
        <small>
          This draft is based only on public page metadata. Claiming it requires
          your consent and FR333MAN verification. You do not need the inviter&apos;s
          ChatGPT account; you create your own FR333MAN sign-in.
        </small>
      </section>
    </main>
  );
}
