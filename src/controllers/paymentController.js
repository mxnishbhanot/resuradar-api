import axios from "axios";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import { generateAuthToken } from "../services/phonepe.js";
import { ensureEnum, ensureString } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

export const initiatePayment = async (req, res) => {
  try {
    const planId = ensureEnum(req.body?.planId, "planId", [config.premiumPlanId]);
    const orderId = ensureString(req.body?.orderId, "orderId", { max: 120 });
    const amount = config.premiumPlanAmountInr;

    const accessToken = await generateAuthToken(config);
    if (!accessToken) {
      throw new Error("Failed to generate PhonePe auth token");
    }

    const payload = {
      merchantOrderId: orderId,
      amount: amount * 100,
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: {
          redirectUrl: config.redirectUrl,
        },
      },
      metaInfo: {
        initiatedAt: new Date().toISOString(),
        source: "resuradar",
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
      amount,
      currency: "INR",
      paymentStatus: "PENDING",
      phonepeResponse: phonepeRes.data,
    });

    return res.status(200).json({
      success: true,
      tokenUrl: redirectUrl,
      order: { orderId, planId, amount, currency: "INR" },
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
