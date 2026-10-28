"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- onboarding uses full navigation around authentication */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "./lib/supabase-browser";
import { release } from "./release";

const questions = [
  {
    prompt: "What evidence would change your mind?",
    options: [
      "Check the source and method, then update my view if the evidence is reliable.",
      "Reject it because it challenges what I already believe.",
      "Share it immediately without checking whether it is reliable.",
    ],
  },
  {
    prompt: "How do you distinguish a fact from an opinion?",
    options: [
      "A fact can be checked against evidence; an opinion expresses a judgement.",
      "A fact is whichever claim the most people repeat.",
      "Facts and opinions are always the same thing.",
    ],
  },
  {
    prompt: "How should people disagree respectfully?",
    options: [
      "Address the idea, listen carefully, and avoid personal attacks.",
      "Silence anyone who disagrees with the majority.",
      "Keep repeating my view without listening to the other person.",
    ],
  },
  {
    prompt: "What responsibility follows freedom of expression?",
    options: [
      "Speak honestly while respecting other people's rights, privacy, and safety.",
      "Say anything without accepting responsibility for avoidable harm.",
      "Only speak when everyone already agrees with me.",
    ],
  },
  {
    prompt: "How do you verify an important claim?",
    options: [
      "Check original sources and compare independent, reliable evidence.",
      "Trust the first result or forwarded message that I receive.",
      "Accept it because it supports something I already believe.",
    ],
  },
  {
    prompt: "When should a community decision be reconsidered?",
    options: [
      "When credible evidence shows harm, an error, or changed circumstances.",
      "Never, because a decision must remain permanent once made.",
      "Whenever I personally do not get the outcome I wanted.",
    ],
  },
  {
    prompt: "How would you repair harm you caused?",
    options: [
      "Acknowledge it, listen, make amends, and change the behaviour.",
      "Deny it and blame the person who was affected.",
      "Apologise only when there will be no consequences for me.",
    ],
  },
  {
    prompt: "What makes cooperation voluntary?",
    options: [
      "People understand the choice and can freely consent or decline.",
      "Pressure is acceptable whenever the cause seems important.",
      "Consent is unnecessary when a majority has already agreed.",
    ],
  },
  {
    prompt: "How should conflicts of interest be declared?",
    options: [
      "Declare it early and step back when it could affect impartial judgement.",
      "Hide it unless another person discovers it first.",
      "Use it quietly when it gives me or my friends an advantage.",
    ],
  },
  {
    prompt: "What practical contribution would you like to make?",
    options: [
      "A realistic task that uses my skills, with progress updates and early requests for help.",
      "Any task that sounds impressive, even if I cannot complete it.",
      "No contribution, while still expecting other People to carry the work.",
    ],
  },
] as const;
const draftStorageKey = "fr333man-onboarding-draft";
const resumeStorageKey = "fr333man-onboarding-resume-step";
const answerIsComplete = (answer: string) => answer.trim().length >= 10;
type Draft = {
  avatar: string;
  region: string;
  memberType: string;
  email: string;
  phone: string;
  answers: string[];
  witness: string;
  identityConsent: boolean;
  witnessConsent: boolean;
  profilePublic: boolean;
  terms: boolean;
  privacy: boolean;
  fee: boolean;
};
type AuthStatus = "checking" | "signed-in" | "signed-out" | "unavailable";
type SubmissionResult = {
  error?: string;
  avatarName?: string;
  profileUrl?: string;
  profilePublic?: boolean;
  status?: string;
};
type Completion = {
  avatarName: string;
  profileUrl: string;
  profilePublic: boolean;
};
const defaultProfileUrl = "/?view=My%20page&onboarding=submitted";
const initial: Draft = {
  avatar: "",
  region: "Randburg",
  memberType: "profile",
  email: "",
  phone: "",
  answers: Array(10).fill(""),
  witness: "",
  identityConsent: false,
  witnessConsent: false,
  profilePublic: true,
  terms: false,
  privacy: false,
  fee: false,
};

const readSavedDraft = (): Draft | null => {
  try {
    const saved = localStorage.getItem(draftStorageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<Draft>;
    return {
      ...initial,
      ...parsed,
      answers: questions.map((_, index) =>
        typeof parsed.answers?.[index] === "string"
          ? parsed.answers[index]
          : "",
      ),
    };
  } catch {
    return null;
  }
};

const resumeStepFor = (draft: Draft) => {
  if (draft.answers.every(answerIsComplete)) return 4;
  if (draft.avatar.trim() && draft.region.trim()) return 3;
  return 2;
};

const readRequestedResumeStep = () => {
  try {
    const saved = Number(localStorage.getItem(resumeStorageKey));
    return Number.isInteger(saved) && saved >= 2 && saved <= 4 ? saved : 2;
  } catch {
    return 2;
  }
};

const rememberResumeStep = (step: number) => {
  try {
    localStorage.setItem(resumeStorageKey, String(Math.min(4, Math.max(2, step))));
  } catch {
    // The questionnaire draft still remains in React state when storage is unavailable.
  }
};

const clearRequestedResumeStep = () => {
  try {
    localStorage.removeItem(resumeStorageKey);
  } catch {
    // A blocked storage API must not prevent onboarding from continuing.
  }
};

export default function OnboardingWizard() {
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const appleEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true";
  const phoneEnabled = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(initial);
  const [notice, setNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [signedInAccount, setSignedInAccount] = useState("");
  const [completion, setCompletion] = useState<Completion | null>(null);
  const draftHydrated = useRef(false);
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
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      const timer = window.setTimeout(() => setAuthStatus("unavailable"), 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    const cleanCallbackUrl = () => {
      const url = new URL(window.location.href);
      for (const parameter of [
        "code",
        "error",
        "error_code",
        "error_description",
      ]) {
        url.searchParams.delete(parameter);
      }
      if (
        url.hash.includes("access_token=") ||
        url.hash.includes("error_description=")
      ) {
        url.hash = "";
      }
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    };
    let redirecting = false;
    const openSubmittedProfile = async (accessToken: string) => {
      try {
        const response = await fetch("/api/people?mine=true", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return false;
        const result = (await response.json()) as {
          profile?: {
            avatar_name?: string;
            trust_status?: string;
            onboarding_status?: string | null;
          } | null;
        };
        const profile = result.profile;
        const submitted =
          profile?.trust_status === "approved" ||
          profile?.onboarding_status === "pending_identity_review" ||
          profile?.onboarding_status === "approved";
        if (!profile || !submitted) return false;
        redirecting = true;
        window.location.replace("/?view=My%20page&onboarding=existing");
        return true;
      } catch {
        return false;
      }
    };
    const acceptSession = (email?: string) => {
      if (!active) return;
      const accountEmail = email?.trim() || "your account";
      const savedDraft = readSavedDraft();
      const recovered = savedDraft || initial;
      const requestedStep = Math.max(
        resumeStepFor(recovered),
        readRequestedResumeStep(),
      );
      setAuthStatus("signed-in");
      setSignedInAccount(email?.trim() || "");
      setDraft((current) => {
        const nextDraft = savedDraft || current;
        return nextDraft.email || !email
          ? nextDraft
          : { ...nextDraft, email };
      });
      setNotice(`Signed in as ${accountEmail}. Continue creating your profile.`);
      setStep((current) =>
        current === 1 ? requestedStep : current,
      );
      clearRequestedResumeStep();
      cleanCallbackUrl();
    };
    let checkedAccessToken = "";
    const handleSession = (accessToken: string, email?: string) => {
      if (redirecting || !active) return;
      acceptSession(email);
      if (checkedAccessToken === accessToken) return;
      checkedAccessToken = accessToken;
      void openSubmittedProfile(accessToken);
    };
    const recoverSession = async () => {
      try {
        const callbackUrl = new URL(window.location.href);
        const callbackError =
          callbackUrl.searchParams.get("error_description") ||
          callbackUrl.searchParams.get("error");
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          handleSession(data.session.access_token, data.session.user.email);
          return;
        }
        if (callbackError) {
          setAuthStatus("signed-out");
          setSignedInAccount("");
          setNotice(
            `Sign-in link could not be completed: ${callbackError.replaceAll("+", " ")}. Request a new link below.`,
          );
          cleanCallbackUrl();
          return;
        }
        if (error) {
          setNotice(`Sign-in could not be completed: ${error.message}`);
        }
        setAuthStatus("signed-out");
        setSignedInAccount("");
      } catch {
        if (!active) return;
        setAuthStatus("signed-out");
        setSignedInAccount("");
        setNotice("Sign-in could not be checked. Your saved answers are safe; try again.");
      }
    };

    void recoverSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        handleSession(session.access_token, session.user.email);
      }
      else if (event === "SIGNED_OUT") {
        setAuthStatus("signed-out");
        setSignedInAccount("");
      }
    });
    const recheckSession = () => void recoverSession();
    window.addEventListener("focus", recheckSession);
    window.addEventListener("storage", recheckSession);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", recheckSession);
      window.removeEventListener("storage", recheckSession);
    };
  }, []);
  useEffect(() => {
    const saved = readSavedDraft();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(saved);
    }
  }, []);
  useEffect(() => {
    if (!draftHydrated.current) {
      draftHydrated.current = true;
      return;
    }
    localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    if (step !== 6 || !completion) return;
    const timer = window.setTimeout(
      () => window.location.replace(completion.profileUrl),
      900,
    );
    return () => window.clearTimeout(timer);
  }, [completion, step]);
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
    const redirectUrl = new URL("/onboarding", window.location.origin);
    if (inviteId) redirectUrl.searchParams.set("invite", inviteId);
    rememberResumeStep(resumeStepFor(draft));
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl.toString() },
    });
    if (error) setNotice(error.message);
  };
  const sendEmailLink = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setNotice("Account connection is temporarily unavailable.");
      return;
    }
    const email = draft.email.trim();
    if (!email) {
      setNotice("Enter your email address first.");
      return;
    }
    const redirectUrl = new URL("/onboarding", window.location.origin);
    if (inviteId) redirectUrl.searchParams.set("invite", inviteId);
    rememberResumeStep(resumeStepFor(draft));
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: true,
        },
      });
      setNotice(
        error
          ? error.message
          : "Secure sign-in link sent. Open it in this same browser; onboarding will continue automatically after sign-in.",
      );
    } catch {
      setNotice("The secure link could not be sent. Check your connection and try again.");
    } finally {
      setAuthBusy(false);
    }
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
    const { data, error } = await supabase.auth.verifyOtp({
      phone: draft.phone,
      token: otp,
      type: "sms",
    });
    if (error) setNotice(error.message);
    else {
      setAuthStatus("signed-in");
      setSignedInAccount(data.user?.phone || draft.phone);
      setNotice("Phone confirmed");
      setStep(Math.max(resumeStepFor(draft), readRequestedResumeStep()));
      clearRequestedResumeStep();
    }
  };
  const continueToIdentity = () => {
    if (authStatus !== "signed-in") {
      rememberResumeStep(4);
      setNotice(
        "Your answers are saved. Sign in before selecting private verification documents.",
      );
      setStep(1);
      return;
    }
    setStep(4);
  };
  const finish = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.terms || !draft.privacy || !draft.fee) return;
    setSaving(true);
    let token = "";
    let submissionSaved = false;
    const uploadedKeys: string[] = [];
    try {
      const supabase = getSupabaseBrowser();
      const session = supabase ? await supabase.auth.getSession() : null;
      token = session?.data.session?.access_token || "";
      if (!token) {
        setAuthStatus("signed-out");
        setStep(1);
        throw new Error(
          "Your completed draft is saved. Sign in before submitting it for review.",
        );
      }
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
        uploadedKeys.push(uploaded.key);
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
      const result = (await response.json().catch(() => ({}))) as SubmissionResult;
      if (!response.ok) {
        throw new Error(result.error || "Submission could not be saved");
      }
      submissionSaved = true;
      localStorage.removeItem(draftStorageKey);
      clearRequestedResumeStep();
      setCompletion({
        avatarName: result.avatarName || draft.avatar,
        profileUrl: result.profileUrl || defaultProfileUrl,
        profilePublic: result.profilePublic ?? draft.profilePublic,
      });
      setNotice("Submission saved. Opening your private People page…");
      setStep(6);
    } catch (error) {
      if (!submissionSaved && token && uploadedKeys.length) {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ keys: uploadedKeys }),
        }).catch(() => undefined);
      }
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
        <span>{release.label}</span>
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
              Sign in before submitting private verification evidence. This does not replace
              identity or member-witness verification.
            </p>
            {authStatus === "signed-in" ? (
              <div className="phone-auth">
                <b>Signed in{signedInAccount ? ` as ${signedInAccount}` : ""}</b>
                <button className="primary" onClick={() => setStep(resumeStepFor(draft))}>
                  Continue with my saved draft
                </button>
              </div>
            ) : (
              <>
                {authStatus === "checking" && <small>Checking your existing sign-in…</small>}
                {(googleEnabled || appleEnabled) && <div className="entry-options">
                  {googleEnabled && <button onClick={() => void social("google")}>
                    G&nbsp; Continue with Google
                  </button>}
                  {appleEnabled && <button onClick={() => void social("apple")}>
                    ● Continue with Apple
                  </button>}
                </div>}
                <div className="phone-auth">
                  <label>
                    Email address
                    <input
                      value={draft.email}
                      onChange={(e) => update("email", e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                  <button
                    disabled={authBusy || authStatus === "unavailable"}
                    onClick={() => void sendEmailLink()}
                  >
                    {authBusy ? "Sending secure link…" : "Email me a secure sign-in link"}
                  </button>
                </div>
                {phoneEnabled && <div className="phone-auth">
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
                </div>}
                <small>
                  Your draft stays on this device. Open the email link in this same browser so it can resume automatically.
                </small>
              </>
            )}
          </article>
        )}
        {step === 2 && (
          <article>
            <h2>Create your profile</h2>
            <p>
              Choose whether your profile becomes public after approval. While
              review is pending, it remains visible only to you and authorised
              reviewers.
            </p>
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
                Peopleship path
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
              <fieldset className="visibility-choice">
                <legend>Profile visibility after approval</legend>
                <label>
                  <input
                    type="radio"
                    name="profile-visibility"
                    checked={draft.profilePublic}
                    onChange={() => update("profilePublic", true)}
                  />
                  <span>
                    <b>Public profile</b>
                    <small>
                      People can find your approved page, biography and shop.
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="profile-visibility"
                    checked={!draft.profilePublic}
                    onChange={() => update("profilePublic", false)}
                  />
                  <span>
                    <b>Private profile</b>
                    <small>
                      Only you can open your People page; it stays out of the
                      public directory.
                    </small>
                  </span>
                </label>
              </fieldset>
              <small className="verification-guidance">
                Change this later from My page → Edit profile → Profile
                visibility.
              </small>
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
              Choose the response that best supports open, respectful and
              responsible participation. Select one answer for every question.
            </p>
            <div className="question-list">
              {questions.map((question, index) => {
                const answer = draft.answers[index] || "";
                const isLegacyAnswer =
                  answerIsComplete(answer) &&
                  !question.options.some((option) => option === answer);
                return (
                  <fieldset className="question-choice" key={question.prompt}>
                    <legend>
                      <b>{index + 1}.</b> {question.prompt}
                    </legend>
                    {isLegacyAnswer && (
                      <label className="selected legacy-answer">
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked
                          onChange={() => undefined}
                        />
                        <span>
                          <b>Keep my previously saved answer</b>
                          <small>{answer}</small>
                        </span>
                      </label>
                    )}
                    {question.options.map((option) => (
                      <label
                        className={answer === option ? "selected" : ""}
                        key={option}
                      >
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={answer === option}
                          onChange={() =>
                            update(
                              "answers",
                              draft.answers.map((current, answerIndex) =>
                                answerIndex === index ? option : current,
                              ),
                            )
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
            <div className="wizard-actions">
              <button onClick={() => setStep(2)}>Back</button>
              <button
                className="primary"
                disabled={draft.answers.some((answer) => !answerIsComplete(answer))}
                onClick={continueToIdentity}
              >
                Continue
              </button>
            </div>
          </article>
        )}
        {step === 4 && (
          <article>
            <h2>Identity and People witness</h2>
            <p>
              Uploads are protected and never shown through the public
              peopleship QR. A trained reviewer must approve this step.
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
                I consent to purpose-limited identity-evidence review.
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
              <span>
                Visibility{" "}
                <b>{draft.profilePublic ? "Public after approval" : "Private"}</b>
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
              Opening {completion?.avatarName ? `@${completion.avatarName}'s` : "your"}
              {" "}private owner page. Trust features remain locked until
              identity and member-witness evidence are approved. Your profile
              {completion?.profilePublic
                ? " will become public only after approval."
                : " will remain private after approval unless you change it under My page → Edit profile → Profile visibility."}
            </p>
            <a className="primary" href={completion?.profileUrl || defaultProfileUrl}>
              Open my People page now
            </a>
          </article>
        )}
      </section>
    </main>
  );
}
