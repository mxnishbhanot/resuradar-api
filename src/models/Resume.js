import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
    {
        filename: String,
        text: String,
        analysis: { type: Object, required: true },
        score: Number,
    },
    { timestamps: true }
);

export default mongoose.model("Resume", resumeSchema);
