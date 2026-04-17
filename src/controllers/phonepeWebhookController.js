import crypto from "crypto";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { extendPremiumFromUser } from "../services/subscriptionAccess.js";
import { logger } from "../utils/logger.js";

const webhookAuthOk = (req) => {
  const user = config.phonepeWebhookUsername;
  const pass = config.phonepeWebhookPassword;
  if (!user || !pass) {
    logger.warn("PHONEPE_WEBHOOK_USERNAME/PASSWORD not set; webhook auth skipped");
    return true;
  }
  const received = (req.get("authorization") || req.get("Authorization") || "").trim();
  const expected = crypto.createHash("sha256").update(`${user}:${pass}`).digest("hex");
  return received === expected;
};

const dedupeKey = (event, payload) => {
  const tx = payload?.paymentDetails?.[0]?.transactionId || "";
  return `${event}:${payload?.orderId || ""}:${payload?.merchantOrderId || ""}:${tx}`.slice(0, 512);
};

const grantSetupIfPendingOrder = async (payload) => {
  if (payload.state !== "COMPLETED") return;
  const merchantOrderId = payload.merchantOrderId;
  if (!merchantOrderId) return;

  const pending = await Order.findOne({ orderId: merchantOrderId, paymentStatus: { $ne: "SUCCESS" } });
  if (!pending) return;

  const msid = payload.paymentFlow?.merchantSubscriptionId || pending.merchantSubscriptionId;
  const sid = payload.paymentFlow?.subscriptionId || null;
  const txId = payload.paymentDetails?.[0]?.transactionId || null;

  const order = await Order.findOneAndUpdate(
    { _id: pending._id, paymentStatus: { $ne: "SUCCESS" } },
    {
      $set: {
        paymentStatus: "SUCCESS",
        merchantSubscriptionId: msid,
        transactionId: txId,
        phonepeResponse: payload,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!order) return;

  const user = await User.findById(order.userId);
  const premiumUntil = extendPremiumFromUser(user);

  await User.findByIdAndUpdate(order.userId, {
    $set: {
      isPremium: true,
      premiumUntil,
      subscriptionStatus: "active",
      merchantSubscriptionId: msid,
      phonepeSubscriptionId: sid,
      lastSubscriptionWebhookAt: new Date(),
    },
  });
};

const grantRedemptionExtend = async (payload) => {
  if (payload.state !== "COMPLETED") return;
  const msid = payload.paymentFlow?.merchantSubscriptionId;
  if (!msid) return;
  const user = await User.findOne({ merchantSubscriptionId: msid });
  if (!user) return;
  const premiumUntil = extendPremiumFromUser(user);
  await User.findByIdAndUpdate(user._id, {
    $set: {
      isPremium: true,
      premiumUntil,
      subscriptionStatus: "active",
      lastSubscriptionWebhookAt: new Date(),
    },
  });
};

const markOrderFailed = async (payload) => {
  const merchantOrderId = payload.merchantOrderId;
  if (!merchantOrderId) return;
  await Order.findOneAndUpdate(
    { orderId: merchantOrderId },
    { $set: { paymentStatus: "FAILED", phonepeResponse: payload, updatedAt: new Date() } }
  );
};

const subscriptionStateUpdate = async (payload, status) => {
  const msid = payload.merchantSubscriptionId || payload.paymentFlow?.merchantSubscriptionId;
  if (!msid) return;
  await User.updateMany(
    { merchantSubscriptionId: msid },
    {
      $set: {
        subscriptionStatus: status,
        phonepeSubscriptionId: payload.subscriptionId || undefined,
        lastSubscriptionWebhookAt: new Date(),
      },
    }
  );
};

export const handlePhonePeWebhook = async (req, res) => {
  if (!webhookAuthOk(req)) {
    return res.status(401).send("Unauthorized");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const event = body.event;
  const payload = body.payload;
  if (!event || !payload) {
    return res.status(400).json({ ok: false, message: "Invalid payload" });
  }

  const key = dedupeKey(event, payload);
  try {
    await WebhookEvent.create({
      dedupeKey: key,
      event,
      payloadSnippet: JSON.stringify(body).slice(0, 1900),
    });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    logger.error("webhook dedupe insert failed", { message: e.message });
    return res.status(500).json({ ok: false });
  }

  try {
    if (event === "checkout.order.completed" && payload.paymentFlow?.type === "SUBSCRIPTION_CHECKOUT_SETUP") {
      await grantSetupIfPendingOrder(payload);
    } else if (event === "checkout.order.failed") {
      await markOrderFailed(payload);
    } else if (
      event === "subscription.redemption.order.completed" ||
      event === "subscription.redemption.transaction.completed"
    ) {
      await grantRedemptionExtend(payload);
    } else if (event === "subscription.cancelled") {
      await subscriptionStateUpdate(payload, "cancelled");
    } else if (event === "subscription.revoked") {
      await subscriptionStateUpdate(payload, "revoked");
    } else if (event === "subscription.paused") {
      await subscriptionStateUpdate(payload, "paused");
    } else if (event === "subscription.unpaused") {
      await subscriptionStateUpdate(payload, "active");
    }
  } catch (err) {
    logger.error("phonepe webhook processing", { message: err.message, event });
    return res.status(500).json({ ok: false });
  }

  return res.status(200).json({ ok: true });
};
