import Resume from "../models/Resume.js";
import User from "../models/User.js";

export const getUser = async (req, res) => {
 try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resumeCount = await Resume.countDocuments({ userId: user._id });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      isPremium: user.isPremium,
      picture: user.picture,
      joinedDate: user.joinedAt,
      resumeCount: resumeCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
