import axios from "axios";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import { generateAuthToken } from "../services/phonepe.js";

export const initiatePayment = async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    // Validate required fields
    if (!amount || !orderId) {
      return res.status(400).json({ success: false, message: "Amount and orderId are required" });
    }

    // Generate PhonePe auth token
    const accessToken = await generateAuthToken(config);
    if (!accessToken) {
      throw new Error("Failed to generate PhonePe auth token");
    }

    // Build payment payload
    const payload = {
      merchantOrderId: orderId,
      amount: amount * 100, // convert INR to paise
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: {
          redirectUrl: config.redirectUrl, // frontend callback URL
        },
      },
      metaInfo: {
        initiatedAt: new Date().toISOString(),
        source: "resuradar",
      },
    };

    // Create payment request
    const phonepeRes = await axios.post(
      `${config.phonepeBase}/checkout/v2/pay`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${accessToken}`,
        },
        timeout: 10000,
      }
    );

    const { redirectUrl } = phonepeRes.data || {};

    if (!redirectUrl) {
      console.error("Missing redirectUrl in PhonePe response:", phonepeRes.data);
      throw new Error("Failed to generate redirect URL from PhonePe");
    }

    // Save initial order in database
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
    });
  } catch (error) {
    console.error("initiatePayment error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Payment initiation failed",
    });
  }
};
