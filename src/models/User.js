import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  picture: String,
  isPremium: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  /** Active paid access until this instant (UTC). Legacy users may only have isPremium. */
  premiumUntil: { type: Date, default: null },
  subscriptionStatus: {
    type: String,
    enum: ["none", "active", "past_due", "cancelled", "revoked", "paused"],
    default: "none",
  },
  /** Merchant-owned subscription id (sent to PhonePe as merchantSubscriptionId). */
  merchantSubscriptionId: { type: String, default: null },
  /** PhonePe subscription id from setup / status APIs. */
  phonepeSubscriptionId: { type: String, default: null },
  /** After N basic-only standard analyses, the next one reveals premium_feedback once. */
  premiumWowStandardUsed: { type: Boolean, default: false },
  lastSubscriptionWebhookAt: { type: Date, default: null },
  /** Lifetime free ATS-style analyses consumed; not decremented when Resume rows are deleted. */
  freeStandardAnalysesConsumed: { type: Number, default: null },
  /** Lifetime free JD matches consumed; not decremented when Resume rows are deleted. */
  freeJdMatchesConsumed: { type: Number, default: null },
});

export default mongoose.model("User", userSchema);
