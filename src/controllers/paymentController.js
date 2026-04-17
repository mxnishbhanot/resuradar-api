import axios from "axios";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import { generateAuthToken } from "../services/phonepe.js";
import { ensureEnum, ensureString } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

const buildMerchantSubscriptionId = (userId) => {
  const base = `MSUB_${String(userId).slice(-8)}_${Date.now().toString(36)}`;
  return base.length <= 63 ? base : base.slice(0, 63);
};

const subscriptionMandateExpireMs = () => Date.now() + 30 * 365 * 24 * 60 * 60 * 1000;

export const initiatePayment = async (req, res) => {
  try {
    const planId = ensureEnum(req.body?.planId, "planId", [config.premiumPlanId]);
    const orderId = ensureString(req.body?.orderId, "orderId", { max: 63 });
    const amountPaisa = config.premiumSetupAmountPaisa;
    const merchantSubscriptionId = buildMerchantSubscriptionId(req.user.userId);

    const accessToken = await generateAuthToken();
    if (!accessToken) {
      throw new Error("Failed to generate PhonePe auth token");
    }

    if (!config.phonepeBase) {
      throw new Error("PHONEPE_BASE is not configured");
    }

    const payload = {
      merchantOrderId: orderId,
      amount: amountPaisa,
      paymentFlow: {
        type: "SUBSCRIPTION_CHECKOUT_SETUP",
        merchantUrls: {
          redirectUrl: config.redirectUrl,
        },
        subscriptionDetails: {
          subscriptionType: "RECURRING",
          merchantSubscriptionId,
          authWorkflowType: "TRANSACTION",
          amountType: "FIXED",
          maxAmount: amountPaisa,
          frequency: "MONTHLY",
          productType: "UPI_MANDATE",
          expireAt: subscriptionMandateExpireMs(),
        },
      },
      metaInfo: {
        initiatedAt: new Date().toISOString(),
        source: "resuradar",
        udf1: String(req.user.userId),
        udf2: merchantSubscriptionId,
        udf3: planId,
      },
    };

    const phonepeRes = await axios.post(`${config.phonepeBase}/checkout/v2/pay`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
      timeout: 10000,
    });

    const { redirectUrl } = phonepeRes.data || {};
    if (!redirectUrl) {
      throw new Error("Failed to generate redirect URL from PhonePe");
    }

    await Order.create({
      userId: req.user.userId,
      orderId,
      amount: Math.round(amountPaisa / 100),
      currency: "INR",
      paymentStatus: "PENDING",
      phonepeResponse: phonepeRes.data,
      kind: "subscription_setup",
      merchantSubscriptionId,
    });

    return res.status(200).json({
      success: true,
      tokenUrl: redirectUrl,
      order: {
        orderId,
        planId,
        amountInr: Math.round(amountPaisa / 100),
        amountPaisa,
        currency: "INR",
        merchantSubscriptionId,
        priceDisplay: `₹${config.premiumPlanAmountInr} ${config.gstDisplayNote}`.trim(),
      },
    });
  } catch (error) {
    logger.error("initiatePayment error", {
      message: error.response?.data || error.message,
      requestId: req.requestId,
    });
    return res.status(500).json({
      success: false,
      message: error.message || "Payment initiation failed",
    });
  }
};
