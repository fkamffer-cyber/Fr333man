"use client";

import { FormEvent, useState } from "react";
import { authenticatedHeaders } from "./lib/supabase-browser";
type Preview = {
  title: string;
  description: string;
  image: string;
  url: string;
  source: string;
};
export default function InviteDesk({
  show,
}: {
  show: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
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
    const response = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
      body: JSON.stringify({
        entity: "invitation",
        title: name,
        data: {
          name,
          message: message.trim().slice(0, 500),
          sourceUrl: preview.url,
          source: preview.source,
          description: preview.description,
          image: preview.image,
          claimed: false,
        },
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !result.id) {
      show(result.error || "Invitation could not be created");
      return;
    }
    const link = `${window.location.origin}/invite/${result.id}`;
    setInvite(link);
    show("Invitation profile created");
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
            Start from a public website or YouTube page, then review every
            detail before sharing.
          </span>
        </div>
      </header>
      <div className="invite-layout">
        <form className="operations-card" onSubmit={create}>
          <label>
            Public page or YouTube link
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
                    {preview.description ||
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
              <a href={invite}>{invite}</a>
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
