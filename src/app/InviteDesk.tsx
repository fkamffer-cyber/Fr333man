"use client";
/* eslint-disable @next/next/no-img-element -- invite previews use reviewed public image hosts that are not known at build time */

import { FormEvent, useState } from "react";
import {
  portableInvitationPath,
  type PortableInvitationData,
} from "@/lib/invitations";
import { authenticatedHeaders } from "./lib/supabase-browser";
type Preview = {
  title: string;
  description: string;
  image: string;
  url: string;
  source: string;
  limited?: boolean;
  notice?: string;
  imported?: {
    name: boolean;
    description: boolean;
    image: boolean;
  };
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
  const [image, setImage] = useState("");
  const [message, setMessage] = useState(
    "I value the work you share and would like to invite you to claim a profile in our people-first community.",
  );
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [trackingNotice, setTrackingNotice] = useState("");
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
      setImage(result.image);
      setInvite("");
      setInviteCode("");
      setCreateError("");
      setTrackingNotice("");
      show(
        result.limited
          ? `${result.source} did not return a complete public profile; complete the marked fields below`
          : "Public page image and details are ready for your review",
      );
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
    setCreateError("");
    setTrackingNotice("");
    const invitationData: PortableInvitationData = {
      name: name.trim().slice(0, 120),
      message: message.trim().slice(0, 500),
      sourceUrl: preview.url,
      source: preview.source,
      description: description.trim().slice(0, 500),
      image: image.trim().slice(0, 2048),
      claimed: false,
    };
    const createPortableInvite = (notice: string) => {
      setInvite(
        `${window.location.origin}${portableInvitationPath(invitationData)}`,
      );
      setInviteCode("");
      setTrackingNotice(notice);
    };
    try {
      const authHeaders = await authenticatedHeaders();
      if (!authHeaders.Authorization) {
        createPortableInvite(
          "This shareable claim link works immediately. Sign in before creating an invitation only when you also need a member tracking code.",
        );
        show("Shareable invitation created");
        return;
      }
      const response = await fetch("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          entity: "invitation",
          title: invitationData.name,
          data: invitationData,
        }),
      });
      const result = (await response.json()) as {
        id?: string | number;
        code?: string;
        error?: string;
      };
      const invitationId = String(result.id ?? "");
      const code = String(result.code || "").toUpperCase();
      if (!response.ok || !invitationId) {
        if (response.status === 401 || response.status >= 500) {
          createPortableInvite(
            response.status === 401
              ? "Your session could not be used for tracking, but this shareable claim link works immediately. Sign in again before creating one when you need a tracking code."
              : "Invitation tracking is temporarily unavailable, but this shareable claim link works immediately and can still be claimed.",
          );
          show("Shareable invitation created");
          return;
        }
        throw new Error(result.error || "The invitation could not be saved.");
      }
      setInvite(
        `${window.location.origin}/invite/${encodeURIComponent(code || invitationId)}`,
      );
      setInviteCode(code);
      show("Invitation profile created");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The invitation could not be saved.";
      setInvite("");
      setInviteCode("");
      setCreateError(message);
      show(message);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(
      `${message}\n\n${invite}${inviteCode ? `\nInvitation code: ${inviteCode}` : ""}`,
    );
    show("Personal invitation copied");
  };
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
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
          <p className="invite-platform-note">
            Automatic import uses only metadata the linked page publishes.
            Facebook and LinkedIn do not allow your signed-in account to copy
            another person&apos;s private profile. The invited person confirms or
            replaces the draft details when claiming it.
          </p>
          {preview && (
            <>
              <div className="invite-preview">
                {image ? (
                  <img
                    src={image}
                    alt={`${name || "Invitation"} public profile`}
                  />
                ) : (
                  <div className="invite-preview-fallback" aria-hidden="true">
                    {initials}
                  </div>
                )}
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
              <div
                className={`invite-import-status${preview.limited ? " is-limited" : ""}`}
                role="status"
              >
                <b>
                  {preview.limited
                    ? `${preview.source} restricted this profile preview`
                    : "Public profile details imported"}
                </b>
                <span>
                  {preview.imported?.name ? "Name imported" : "Name inferred from link"}
                  {" · "}
                  {preview.imported?.image ? "Photo imported" : "Photo not returned"}
                  {" · "}
                  {preview.imported?.description
                    ? "Biography imported"
                    : "Biography not returned"}
                </span>
                {preview.limited && (
                  <p>
                    FR333MAN can import only what the public link exposes. It
                    cannot use your signed-in social session to copy another
                    person&apos;s account. Review the source, then complete the
                    photo link and summary below before sharing.
                  </p>
                )}
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
                Public profile image link (optional)
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://…"
                />
                <small>
                  Some social platforms withhold profile photos. You can paste
                  a public image link after confirming it belongs to the invited
                  person.
                </small>
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
                    {preview.notice ||
                      "This platform restricted its preview. The clean placeholder above will be used unless you add a verified public image."}
                  </small>
                )}
              </label>
              <p className="invite-consent">
                Only public metadata is used. The invited person must claim the
                draft, consent to its use and complete verification before it
                becomes a People profile.
              </p>
              <button className="primary">Create invitation link</button>
            </>
          )}
          {createError && (
            <div className="onboarding-notice" role="alert">
              <b>Invitation not created</b>
              <p>{createError}</p>
              {createError.toLowerCase().includes("sign in") && (
                <a className="primary" href="/onboarding">
                  Sign in or complete onboarding
                </a>
              )}
            </div>
          )}
          {invite && (
            <div className="invite-result">
              <b>Ready to share</b>
              {trackingNotice && <span>{trackingNotice}</span>}
              {inviteCode && (
                <span>
                  Invitation code: <strong>{inviteCode}</strong>
                </span>
              )}
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
                {inviteCode ? "Copy message, code and link" : "Copy message and link"}
              </button>
              <small>
                The recipient creates their own FR333MAN sign-in during
                claiming. The hosted Site must be publicly shared before an
                outside recipient can open it without a ChatGPT access prompt.
              </small>
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
