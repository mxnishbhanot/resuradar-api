import User from "../models/User.js";

export const getUser = async (req, res) => {
 try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      isPremium: user.isPremium,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
