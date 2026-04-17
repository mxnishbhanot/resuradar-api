import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
    {
        filename: String,
        /** User-defined label for dashboard cards (ATS / job match). */
        displayName: { type: String, default: null, maxlength: 120 },
        text: String,
        analysis: { type: Object, required: true },
        score: Number,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: ["standard", "job_match", 'created'], default: "standard" },
    },
    { timestamps: true }
);

resumeSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model("Resume", resumeSchema);
