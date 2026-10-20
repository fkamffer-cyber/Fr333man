"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- onboarding uses full navigation around authentication */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "./lib/supabase-browser";

const questions = [
  "What evidence would change your mind?",
  "How do you distinguish a fact from an opinion?",
  "How should people disagree respectfully?",
  "What responsibility follows freedom of expression?",
  "How do you verify an important claim?",
  "When should a community decision be reconsidered?",
  "How would you repair harm you caused?",
  "What makes cooperation voluntary?",
  "How should conflicts of interest be declared?",
  "What practical contribution would you like to make?",
];
type Draft = {
  avatar: string;
  region: string;
  memberType: string;
  phone: string;
  answers: string[];
  witness: string;
  identityConsent: boolean;
  witnessConsent: boolean;
  terms: boolean;
  privacy: boolean;
  fee: boolean;
};
const initial: Draft = {
  avatar: "fr333man",
  region: "Randburg",
  memberType: "profile",
  phone: "",
  answers: Array(10).fill(""),
  witness: "",
  identityConsent: false,
  witnessConsent: false,
  terms: false,
  privacy: false,
  fee: false,
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(initial);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [witnessFile, setWitnessFile] = useState<File | null>(null);
  const [inviteId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("invite") || "",
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fr333man-onboarding-draft");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft({ ...initial, ...JSON.parse(saved) });
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("fr333man-onboarding-draft", JSON.stringify(draft));
  }, [draft]);
  const progress = useMemo(() => Math.round((step / 5) * 100), [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const social = async (provider: "google" | "apple") => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice(
        "Add the Supabase public URL and publishable key to activate account connection.",
      );
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) setNotice(error.message);
  };
  const sendOtp = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice("Supabase phone authentication is not configured yet.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ phone: draft.phone });
    if (error) setNotice(error.message);
    else {
      setOtpSent(true);
      setNotice("Verification code sent");
    }
  };
  const verifyOtp = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.verifyOtp({
      phone: draft.phone,
      token: otp,
      type: "sms",
    });
    if (error) setNotice(error.message);
    else {
      setNotice("Phone confirmed");
      setStep(2);
    }
  };
  const finish = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.terms || !draft.privacy || !draft.fee) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const session = supabase ? await supabase.auth.getSession() : null;
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in is required before submission");
      let identityDocumentPath = "";
      let witnessSelfiePath = "";
      for (const [purpose, file] of [["identity", identityFile], ["witness-selfie", witnessFile]] as const) {
        if (!file) throw new Error("Both verification files are required");
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", purpose);
        const upload = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const uploaded = (await upload.json()) as { key?: string; error?: string };
        if (!upload.ok || !uploaded.key)
          throw new Error(uploaded.error || "Verification upload failed");
        if (purpose === "identity") identityDocumentPath = uploaded.key;
        else witnessSelfiePath = uploaded.key;
      }
      const response = await fetch("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          entity: "profile",
          title: `Onboarding · ${draft.avatar}`,
          data: {
            ...draft,
            status: "pending_identity_review",
            submittedAt: new Date().toISOString(),
            inviteId,
            identityDocumentPath,
            witnessSelfiePath,
          },
        }),
      });
      if (!response.ok) throw new Error();
      localStorage.removeItem("fr333man-onboarding-draft");
      setStep(6);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Submission could not be saved. Your draft remains on this device.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="onboarding-page">
      <nav>
        <a href="/?view=My%20page">
          FR<span>333</span>MAN
        </a>
        <a href="/?view=My%20page">Save and return later</a>
      </nav>
      <section className="onboarding-shell">
        <header>
          <p>PEOPLE ONBOARDING</p>
          <h1>
            {step === 6
              ? "Submitted for people review"
              : "Build your trusted profile"}
          </h1>
          {step < 6 && (
            <>
              <div className="onboarding-progress">
                <i style={{ width: `${progress}%` }} />
              </div>
              <span>Step {step} of 5 · Your draft saves on this device.</span>
            </>
          )}
        </header>
        {notice && (
          <div className="onboarding-notice" role="status">
            {notice}
          </div>
        )}
        {step === 1 && (
          <article>
            <h2>Connect an entry account</h2>
            <p>
              Use an existing account for easier sign-in. This does not replace
              identity, liveness or member-witness verification.
            </p>
            <div className="entry-options">
              <button onClick={() => void social("google")}>
                G&nbsp; Continue with Google
              </button>
              <button onClick={() => void social("apple")}>
                ● Continue with Apple
              </button>
            </div>
            <div className="phone-auth">
              <label>
                Mobile number
                <input
                  value={draft.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  type="tel"
                  placeholder="+27…"
                />
              </label>
              {!otpSent ? (
                <button onClick={() => void sendOtp()}>Send code</button>
              ) : (
                <>
                  <label>
                    Verification code
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <button onClick={() => void verifyOtp()}>Verify code</button>
                </>
              )}
            </div>
            <button className="text-button" onClick={() => setStep(2)}>
              Continue and connect later →
            </button>
          </article>
        )}
        {step === 2 && (
          <article>
            <h2>Create your profile</h2>
            <p>Your page can be visible before trust features are activated.</p>
            <div className="onboarding-form">
              <label>
                Avatar name
                <input
                  value={draft.avatar}
                  onChange={(e) => update("avatar", e.target.value)}
                  required
                />
              </label>
              <label>
                Region
                <input
                  value={draft.region}
                  onChange={(e) => update("region", e.target.value)}
                  required
                />
              </label>
              <label>
                Membership path
                <select
                  value={draft.memberType}
                  onChange={(e) => update("memberType", e.target.value)}
                >
                  <option value="profile">Profile and marketplace</option>
                  <option value="project">Project contributor</option>
                  <option value="administration">
                    Administration applicant
                  </option>
                </select>
              </label>
            </div>
            <div className="wizard-actions">
              <button onClick={() => setStep(1)}>Back</button>
              <button
                className="primary"
                disabled={!draft.avatar || !draft.region}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </article>
        )}
        {step === 3 && (
          <article>
            <h2>Free-thinking validation</h2>
            <p>
              Brief answers help the Ethics Committee understand how you examine
              claims and resolve disagreement.
            </p>
            <div className="question-list">
              {questions.map((question, index) => (
                <label key={question}>
                  <span>
                    {index + 1}. {question}
                  </span>
                  <textarea
                    rows={2}
                    value={draft.answers[index]}
                    onChange={(e) =>
                      update(
                        "answers",
                        draft.answers.map((answer, i) =>
                          i === index ? e.target.value : answer,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="wizard-actions">
              <button onClick={() => setStep(2)}>Back</button>
              <button
                className="primary"
                disabled={draft.answers.some(
                  (answer) => answer.trim().length < 10,
                )}
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </div>
          </article>
        )}
        {step === 4 && (
          <article>
            <h2>Identity, liveness and people witness</h2>
            <p>
              Uploads are protected and never shown through the public
              membership QR. A trained reviewer must approve this step.
            </p>
            <div className="onboarding-form">
              <label>
                Government ID or licence
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  required
                  onChange={(event) => setIdentityFile(event.target.files?.[0] || null)}
                />
              </label>
              <label>
                Existing member handle
                <input
                  value={draft.witness}
                  onChange={(e) => update("witness", e.target.value)}
                  placeholder="@member"
                />
              </label>
              <label>
                Joint selfie: new member + existing member
                <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setWitnessFile(event.target.files?.[0] || null)} />
              </label>
              <small className="verification-guidance">
                Both people must be clearly visible in the same photo. This
                image stays private and is used only for member-witness
                verification.
              </small>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.identityConsent}
                  onChange={(e) => update("identityConsent", e.target.checked)}
                />{" "}
                I consent to purpose-limited identity and liveness verification.
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.witnessConsent}
                  onChange={(e) => update("witnessConsent", e.target.checked)}
                />{" "}
                The existing member and I consent to the witness selfie and
                review.
              </label>
            </div>
            <div className="wizard-actions">
              <button onClick={() => setStep(3)}>Back</button>
              <button
                className="primary"
                disabled={
                  !draft.identityConsent ||
                  !draft.witnessConsent ||
                  !draft.witness ||
                  !identityFile ||
                  !witnessFile
                }
                onClick={() => setStep(5)}
              >
                Continue
              </button>
            </div>
          </article>
        )}
        {step === 5 && (
          <form onSubmit={finish}>
            <h2>Review and submit</h2>
            <p>
              Your account-opening fee becomes payable only on day 14 if the
              account remains open. Submission does not collect payment.
            </p>
            <div className="review-box">
              <span>
                Avatar <b>@{draft.avatar}</b>
              </span>
              <span>
                Region <b>{draft.region}</b>
              </span>
              <span>
                Path <b>{draft.memberType}</b>
              </span>
              <span>
                Witness <b>{draft.witness}</b>
              </span>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.terms}
                onChange={(e) => update("terms", e.target.checked)}
              />{" "}
              I accept the{" "}
              <a href="/policies/terms" target="_blank">
                platform terms
              </a>
              .
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.privacy}
                onChange={(e) => update("privacy", e.target.checked)}
              />{" "}
              I have read the{" "}
              <a href="/policies/privacy" target="_blank">
                privacy and POPIA notice
              </a>
              .
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.fee}
                onChange={(e) => update("fee", e.target.checked)}
              />{" "}
              I understand the USD 10 fee is due on day 14 unless I cancel
              before then.
            </label>
            <div className="wizard-actions">
              <button type="button" onClick={() => setStep(4)}>
                Back
              </button>
              <button
                className="primary"
                disabled={
                  !draft.terms || !draft.privacy || !draft.fee || saving
                }
              >
                {saving ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </form>
        )}
        {step === 6 && (
          <article className="onboarding-complete">
            <b>Profile onboarding received</b>
            <p>
              Trust features remain locked until identity, liveness and witness
              evidence are approved. Administration applicants also require
              Ethics Committee approval.
            </p>
            <a className="primary" href="/?view=My%20page">
              Return to my page
            </a>
          </article>
        )}
      </section>
    </main>
  );
}
