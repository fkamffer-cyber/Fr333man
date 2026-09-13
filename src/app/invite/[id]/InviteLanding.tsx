"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- claim flow uses full navigation */
import { useEffect, useState } from "react";
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
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    void fetch(`/api/community?id=${encodeURIComponent(id)}`)
      .then(async (response) =>
        (await response.json()) as {
          records?: { entity: string; data: Invite }[];
        },
      )
      .then((result) => {
        const record = result.records?.[0];
        if (record?.entity === "invitation") setInvite(record.data);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
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
  return (
    <main className="invite-landing">
      <nav>
        <a href="/">
          FR<span>333</span>MAN
        </a>
        <small>UNCLAIMED PROFILE DRAFT</small>
      </nav>
      <section>
        {invite.image && <img src={invite.image} alt="" />}
        <p>YOU ARE INVITED</p>
        <h1>{invite.name}</h1>
        <blockquote>{invite.message}</blockquote>
        <p>{invite.description}</p>
        <div>
          <a href={invite.sourceUrl} target="_blank" rel="noreferrer">
            Review the public source ↗
          </a>
          <a
            className="primary"
            href={`/onboarding?invite=${encodeURIComponent(id)}`}
          >
            Claim this profile
          </a>
        </div>
        <small>
          This draft is based only on public page metadata. Claiming it requires
          your consent and FR333MAN verification.
        </small>
      </section>
    </main>
  );
}
