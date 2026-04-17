import Resume from "../models/Resume.js";
import { config } from "../config/config.js";
import { userHasActivePremium } from "../services/subscriptionAccess.js";
import { ensureFreeTrialCounters } from "../services/trialUsageService.js";

export const getUser = async (req, res) => {
  try {
    const user = await ensureFreeTrialCounters(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const resumeCount = await Resume.countDocuments({ userId: user._id });
    const standardUsed = user.freeStandardAnalysesConsumed ?? 0;
    const jdUsed = user.freeJdMatchesConsumed ?? 0;
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
