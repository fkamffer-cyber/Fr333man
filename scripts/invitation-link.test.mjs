import assert from "node:assert/strict";
import test from "node:test";
import {
  decodePortableInvitation,
  encodePortableInvitation,
  portableInvitationPath,
  inferredInvitationName,
} from "../src/lib/invitations.ts";

const invitation = {
  name: "Kwaai Lappies",
  message: "You are invited to join the People’s platform.",
  sourceUrl: "https://www.facebook.com/kwaai.lappies.7",
  source: "Facebook",
  description: "A public, source-checked summary.",
  image: "https://example.com/profile.jpg",
  claimed: false,
};

test("portable invitation links round-trip Unicode profile data", () => {
  const encoded = encodePortableInvitation(invitation);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePortableInvitation(encoded), invitation);
  assert.equal(
    portableInvitationPath(invitation),
    `/invite/draft#data=${encoded}`,
  );
});

test("invalid portable invitation data is rejected", () => {
  assert.equal(decodePortableInvitation("not-valid-json"), null);
});

test("social profile links produce useful editable names when previews are blocked", () => {
  assert.equal(
    inferredInvitationName(
      "https://www.facebook.com/kwaai.lappies.7",
      "Facebook",
    ),
    "kwaai lappies 7",
  );
  assert.equal(
    inferredInvitationName(
      "https://www.linkedin.com/in/jane-example",
      "LinkedIn",
    ),
    "jane example",
  );
});
