import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/config.js";

export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    // Validate required field
    if (!token) {
      return res.status(400).json({ message: "Google access token is required" });
    }

    // Get user info from Google
    const googleRes = await axios.get(
      `${config.googleBaseUrl}/v1/userinfo?alt=json&access_token=${token}`,
      { timeout: 8000 }
    );

    const { id: googleId, email, name, picture } = googleRes.data;

    // Check if user already exists or create new one
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        picture,
        isPremium: false, // default non-premium
      });
    } else {
      // Update user profile info if changed
      const updatedFields = {};
      if (user.name !== name) updatedFields.name = name;
      if (user.picture !== picture) updatedFields.picture = picture;
      if (Object.keys(updatedFields).length) {
        await User.findByIdAndUpdate(user._id, updatedFields);
      }
    }

    // Generate app JWT
    const appToken = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token: appToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error("googleAuth error:", err.response?.data || err.message);
    return res.status(401).json({ message: "Invalid or expired Google token" });
  }
};
