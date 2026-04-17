import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "01234567890123456789012345678901";

const {
  userHasActivePremium,
  extendPremiumFromUser,
} = await import("./subscriptionAccess.js");

test("userHasActivePremium: legacy isPremium without date", () => {
  assert.equal(userHasActivePremium({ isPremium: true }), true);
});

test("userHasActivePremium: premiumUntil in future", () => {
  const future = new Date(Date.now() + 86400000);
  assert.equal(userHasActivePremium({ premiumUntil: future, subscriptionStatus: "active" }), true);
});

test("userHasActivePremium: expired premiumUntil", () => {
  const past = new Date(Date.now() - 86400000);
  assert.equal(userHasActivePremium({ isPremium: true, premiumUntil: past }), false);
});

test("userHasActivePremium: revoked", () => {
  const future = new Date(Date.now() + 86400000);
  assert.equal(userHasActivePremium({ premiumUntil: future, subscriptionStatus: "revoked" }), false);
});

test("extendPremiumFromUser stacks from existing window", () => {
  const future = new Date(Date.now() + 5 * 86400000);
  const user = { premiumUntil: future };
  const next = extendPremiumFromUser(user);
  assert.ok(next.getTime() > future.getTime());
});
