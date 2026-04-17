import axios from "axios";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { generateAuthToken } from "../services/phonepe.js";
import { extendPremiumFromUser } from "../services/subscriptionAccess.js";
import { logger } from "../utils/logger.js";

export const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const accessToken = await generateAuthToken();
    if (!accessToken) {
      throw new Error("Failed to generate PhonePe auth token");
    }

    const statusRes = await axios.get(
      `${config.phonepeBase}/checkout/v2/order/${orderId}/status?details=false&errorContext=false`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${accessToken}`,
        },
        timeout: 10000,
      }
    );

    const orderStatus = statusRes.data;
    const result = {
      status: orderStatus.state,
      transactionId: orderStatus.paymentDetails?.[0]?.transactionId || null,
      amount: orderStatus.amount,
      errorCode: orderStatus.errorCode || null,
      expireAt: orderStatus.expireAt,
      merchantSubscriptionId: orderStatus.paymentFlow?.merchantSubscriptionId || null,
      phonepeSubscriptionId: orderStatus.paymentFlow?.subscriptionId || null,
    };

    const existing = await Order.findOne({ orderId, userId: req.user.userId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const prevStatus = existing.paymentStatus;

    const order = await Order.findOneAndUpdate(
      { orderId, userId: req.user.userId },
      {
        paymentStatus:
          result.status === "COMPLETED"
            ? "SUCCESS"
            : result.status === "FAILED"
            ? "FAILED"
            : "PENDING",
        transactionId: result.transactionId,
        phonepeResponse: orderStatus,
        merchantSubscriptionId: result.merchantSubscriptionId || existing.merchantSubscriptionId,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (result.status === "COMPLETED" && prevStatus !== "SUCCESS") {
      const user = await User.findById(req.user.userId);
      const premiumUntil = extendPremiumFromUser(user);
      await User.findByIdAndUpdate(req.user.userId, {
        $set: {
          isPremium: true,
          premiumUntil,
          subscriptionStatus: "active",
          merchantSubscriptionId: result.merchantSubscriptionId || order.merchantSubscriptionId,
          phonepeSubscriptionId: result.phonepeSubscriptionId || user?.phonepeSubscriptionId,
        },
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("verifyPayment error", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      requestId: req.requestId,
    });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};
