import Resume from "../models/Resume.js";
import User from "../models/User.js";
import { config } from "../config/config.js";
import { userHasActivePremium } from "../services/subscriptionAccess.js";

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const resumeCount = await Resume.countDocuments({ userId: user._id });
    const standardUsed = await Resume.countDocuments({ userId: user._id, type: "standard" });
    const jdUsed = await Resume.countDocuments({ userId: user._id, type: "job_match" });
    const hasActivePremium = userHasActivePremium(user);

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      isPremium: hasActivePremium,
      hasActivePremium,
      picture: user.picture,
      joinedDate: user.joinedAt,
      resumeCount,
      standardUsed,
      standardLimit: config.freeStandardAnalysisLimit,
      jdUsed,
      jdLimit: config.freeJdMatchLimit,
      premiumUntil: user.premiumUntil,
      subscriptionStatus: user.subscriptionStatus,
      freeBuilderTemplates: config.freeBuilderTemplates,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
