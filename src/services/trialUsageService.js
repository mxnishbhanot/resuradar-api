import Resume from "../models/Resume.js";
import User from "../models/User.js";

const needsCounterBackfill = (user) =>
  user.freeStandardAnalysesConsumed == null || user.freeJdMatchesConsumed == null;

/**
 * Ensures free-tier usage counters exist and match historical Resume rows (one-time per user).
 * After backfill, quota must use these fields only — deletions do not decrement them.
 */
export async function ensureFreeTrialCounters(userId) {
  let user = await User.findById(userId);
  if (!user) return null;
  if (!needsCounterBackfill(user)) return user;

  const uid = user._id;
  const [standardFromDb, jdFromDb] = await Promise.all([
    Resume.countDocuments({ userId: uid, type: "standard" }),
    Resume.countDocuments({ userId: uid, type: "job_match" }),
  ]);

  return User.findByIdAndUpdate(
    uid,
    {
      $set: {
        freeStandardAnalysesConsumed: standardFromDb,
        freeJdMatchesConsumed: jdFromDb,
      },
    },
    { new: true }
  );
}
