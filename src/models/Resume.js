import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
    {
        filename: String,
        text: String,
        analysis: { type: Object, required: true },
        score: Number,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: ["standard", "job_match", 'created'], default: "standard" },
    },
    { timestamps: true }
);

export default mongoose.model("Resume", resumeSchema);
