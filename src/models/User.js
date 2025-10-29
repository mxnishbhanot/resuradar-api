import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  picture: String,
  isPremium: { type: Boolean, default: false },
});

export default mongoose.model("User", userSchema);
