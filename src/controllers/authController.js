import axios from "axios";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { config } from "../config/config.js";

const googleClient = new OAuth2Client(config.googleClientId);

export const googleAuth = async (req, res) => {
  try {
    const { token, idToken } = req.body;
    const authToken = token || idToken; // accept either key
    if (!authToken) {
      return res.status(400).json({ message: "Google token is required" });
    }

    let userInfo;

    if (idToken) {
      // ✅ Handle One Tap ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: authToken,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      userInfo = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } else {
      // ✅ Handle OAuth access token
      const googleRes = await axios.get(
        `${config.googleBaseUrl}/v1/userinfo?alt=json&access_token=${authToken}`,
        { timeout: 8000 }
      );
      userInfo = {
        googleId: googleRes.data.id,
        email: googleRes.data.email,
        name: googleRes.data.name,
        picture: googleRes.data.picture,
      };
    }

    // 🔐 Upsert user in DB
    let user = await User.findOne({ googleId: userInfo.googleId });
    if (!user) {
      user = await User.create({
        ...userInfo,
        isPremium: false,
        joinedAt: new Date(),
      });
    } else {
      await User.findByIdAndUpdate(user._id, {
        name: userInfo.name,
        picture: userInfo.picture,
      });
    }

    // 🔑 Generate app JWT
    const appToken = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({
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
