"use client";

import { FormEvent, useState } from "react";
import { authenticatedHeaders } from "./lib/supabase-browser";
type Preview = {
  title: string;
  description: string;
  image: string;
  url: string;
  source: string;
  limited?: boolean;
};
export default function InviteDesk({
  show,
}: {
  show: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState(
    "I value the work you share and would like to invite you to claim a profile in our people-first community.",
  );
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState("");
  const inspect = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
      setName(result.title);
      setDescription(result.description);
      show("Public page preview is ready for your review");
    } catch (error) {
      show(
        error instanceof Error
          ? error.message
          : "That link could not be previewed",
      );
    } finally {
      setLoading(false);
    }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    const invitationData = {
      name: name.trim().slice(0, 120),
      message: message.trim().slice(0, 500),
      sourceUrl: preview.url,
      source: preview.source,
      description: description.trim().slice(0, 500),
      image: preview.image,
      claimed: false,
    };
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authenticatedHeaders()),
        },
        body: JSON.stringify({
          entity: "invitation",
          title: invitationData.name,
          data: invitationData,
        }),
      });
      const result = (await response.json()) as {
        id?: string | number;
      };
      const invitationId = String(result.id ?? "");
      if (!response.ok || !invitationId) throw new Error();
      setInvite(
        `${window.location.origin}/invite/${encodeURIComponent(invitationId)}`,
      );
      show("Invitation profile created");
    } catch {
      const bytes = new TextEncoder().encode(JSON.stringify(invitationData));
      const encoded = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      setInvite(`${window.location.origin}/invite/draft#data=${encoded}`);
      show("Portable invitation link created");
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${message}\n\n${invite}`);
    show("Personal invitation copied");
  };
  return (
    <section className="operations-shell invite-desk">
      <header className="operations-hero">
        <div>
          <p>PEOPLE INVITATIONS</p>
          <h1>Invite with context</h1>
          <span>
            Start from Facebook, LinkedIn, YouTube or another public page, then
            review every detail before sharing.
          </span>
        </div>
      </header>
      <div className="invite-layout">
        <form className="operations-card" onSubmit={create}>
          <label>
            Facebook, LinkedIn, YouTube or public-page link
            <div className="url-control">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://…"
              />
              <button
                type="button"
                onClick={() => void inspect()}
                disabled={loading || !url}
              >
                {loading ? "Reading…" : "Build draft"}
              </button>
            </div>
          </label>
          {preview && (
            <>
              <div className="invite-preview">
                {preview.image && <img src={preview.image} alt="" />}
                <span>
                  <small>{preview.source} · UNCLAIMED PROFILE DRAFT</small>
                  <h2>{name}</h2>
                  <p>
                    {description ||
                      "No public description was supplied. Add only information you can verify."}
                  </p>
                  <a href={preview.url} target="_blank" rel="noreferrer">
                    Review source ↗
                  </a>
                </span>
              </div>
              <label>
                Profile display name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Personal message
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={5}
                  required
                />
                <small>{message.length}/500</small>
              </label>
              <label>
                Public profile summary
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Add a short, source-checked description"
                />
                {preview.limited && (
                  <small>
                    This platform restricted its preview. Confirm the source
                    and complete this summary manually.
                  </small>
                )}
              </label>
              <p className="invite-consent">
                Only public metadata is used. The invited person must claim the
                draft, consent to its use and complete verification before it
                becomes a member profile.
              </p>
              <button className="primary">Create invitation link</button>
            </>
          )}
          {invite && (
            <div className="invite-result">
              <b>Ready to share</b>
              <a href={invite} target="_blank" rel="noreferrer">
                {invite}
              </a>
              <a
                className="primary"
                href={invite}
                target="_blank"
                rel="noreferrer"
              >
                Open invitation
              </a>
              <button type="button" onClick={() => void copy()}>
                Copy message and link
              </button>
            </div>
          )}
        </form>
        <aside className="operations-card">
          <p>CONCISE INVITATION</p>
          <h2>What the recipient sees</h2>
          <ol>
            <li>Your personalised message</li>
            <li>The public source used for the draft</li>
            <li>A clear “unclaimed” label</li>
            <li>A claim-and-onboard action</li>
          </ol>
          <small>
            No email, social message or public profile is sent automatically.
          </small>
        </aside>
      </div>
    </section>
  );
}
