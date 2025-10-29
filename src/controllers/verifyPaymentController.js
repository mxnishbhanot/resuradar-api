import axios from "axios";
import { config } from "../config/config.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { generateAuthToken } from "../services/phonepe.js";

export const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    // Generate a fresh PhonePe auth token
    const accessToken = await generateAuthToken(config);
    if (!accessToken) {
      throw new Error("Failed to generate PhonePe auth token");
    }

    // Fetch order status from PhonePe API
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

    // Map response fields for frontend
    const result = {
      status: orderStatus.state, // COMPLETED / PENDING / FAILED
      transactionId: orderStatus.paymentDetails?.[0]?.transactionId || null,
      amount: orderStatus.amount,
      errorCode: orderStatus.errorCode || null,
      expireAt: orderStatus.expireAt,
    };

    // Update local order record
    await Order.findOneAndUpdate(
      { orderId },
      {
        paymentStatus:
          result.status === "COMPLETED"
            ? "SUCCESS"
            : result.status === "FAILED"
            ? "FAILED"
            : "PENDING",
        transactionId: result.transactionId,
        phonepeResponse: orderStatus,
        updatedAt: new Date(),
      },
      { new: true }
    );

    // Mark user as premium if payment completed
    if (result.status === "COMPLETED" && req.user?.userId) {
      await User.findByIdAndUpdate(req.user.userId, { $set: { isPremium: true } });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("verifyPayment error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};
