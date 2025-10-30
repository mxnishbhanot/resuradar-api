import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  picture: String,
  isPremium: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
