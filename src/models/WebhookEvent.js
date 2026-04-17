import mongoose from "mongoose";

/** Idempotency for PhonePe webhook deliveries */
const webhookEventSchema = new mongoose.Schema({
  dedupeKey: { type: String, required: true, unique: true },
  event: { type: String, required: true },
  payloadSnippet: { type: String, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("WebhookEvent", webhookEventSchema);
