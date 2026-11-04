import assert from "node:assert/strict";
import test from "node:test";
import { invitationImageError } from "../src/lib/invitation-media.ts";

test("accepts supported invitation profile images", () => {
  assert.equal(invitationImageError({ size: 500_000, type: "image/jpeg" }), "");
  assert.equal(invitationImageError({ size: 500_000, type: "image/png" }), "");
  assert.equal(invitationImageError({ size: 500_000, type: "image/webp" }), "");
});

test("rejects oversized and unsupported invitation uploads", () => {
  assert.equal(
    invitationImageError({ size: 8_000_001, type: "image/jpeg" }),
    "Image must be under 8 MB",
  );
  assert.equal(
    invitationImageError({ size: 500_000, type: "image/svg+xml" }),
    "Use a JPEG, PNG or WebP image",
  );
});
