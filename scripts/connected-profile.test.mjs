import assert from "node:assert/strict";
import test from "node:test";
import {
  avatarSuggestion,
  connectedProfile,
  providerName,
} from "../src/lib/connected-profile.ts";

test("maps consented OAuth metadata into an editable People profile", () => {
  assert.deepEqual(
    connectedProfile({
      email: "person@example.com",
      app_metadata: { provider: "facebook" },
      user_metadata: {
        full_name: "Élodie Example",
        picture: "https://images.example.com/person.jpg",
      },
    }),
    {
      email: "person@example.com",
      phone: "",
      displayName: "Élodie Example",
      avatarUrl: "https://images.example.com/person.jpg",
      provider: "facebook",
      avatar: "elodie-example",
    },
  );
  assert.equal(providerName("facebook"), "Facebook");
});

test("uses the email name as a fallback and rejects unsafe photo URLs", () => {
  const profile = connectedProfile({
    email: "New.Person@example.com",
    app_metadata: { provider: "google" },
    user_metadata: { avatar_url: "javascript:alert(1)" },
  });
  assert.equal(profile.avatar, "new.person");
  assert.equal(profile.avatarUrl, "");
  assert.equal(avatarSuggestion("--"), "");
});
