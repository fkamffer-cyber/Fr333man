export type ConnectedUser = {
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

const metadataText = (value: unknown, maximum = 160) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

export const avatarSuggestion = (value: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 40);
  return normalized.length >= 3 ? normalized : "";
};

export const connectedProfile = (user: ConnectedUser) => {
  const metadata = user.user_metadata || {};
  const email = metadataText(user.email, 320);
  const displayName = metadataText(
    metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      metadata.preferred_username,
    120,
  );
  const avatarUrl = metadataText(metadata.avatar_url || metadata.picture, 2048);
  const provider = metadataText(user.app_metadata?.provider, 40);
  return {
    email,
    phone: metadataText(user.phone, 40),
    displayName,
    avatarUrl: /^https?:\/\//i.test(avatarUrl) ? avatarUrl : "",
    provider,
    avatar:
      avatarSuggestion(displayName) ||
      avatarSuggestion(email.split("@")[0] || ""),
  };
};

export const providerName = (provider: string) =>
  ({
    google: "Google",
    facebook: "Facebook",
    linkedin_oidc: "LinkedIn",
    apple: "Apple",
    azure: "Microsoft",
  })[provider] || "your connected account";
