import mongoose from "mongoose";
import crypto from "crypto";

// --- Sub Schemas matching Angular Interfaces ---

const skillCategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  skills: [String] // Array of skill strings within the category
}, { _id: false });

const projectSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  role: String,
  link: String,
  startDate: String,
  endDate: String,
  isCurrent: { type: Boolean, default: false },
  techStack: [String],
  bullets: [String]
}, { _id: false });

const educationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  institution: { type: String, required: true }, // Changed from 'school'
  degree: { type: String, required: true },
  major: { type: String, default: '' },
  startDate: String,
  endDate: String,
  isCurrent: { type: Boolean, default: false },
  gpa: String,
  bullets: [String] // Changed from 'description'
}, { _id: false });

const experienceSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  company: String,
  startDate: String,
  endDate: String,
  isCurrent: { type: Boolean, default: false },
  bullets: [String],
  role: String,
  link: String,
}, { _id: false });

// --- Main Resume Schema ---

const customResumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  personal: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    location: String,
    headline: String,
    summary: String, // Added 'summary' to PersonalInfo
  },
  educations: [educationSchema], // Using new educationSchema
  experiences: [experienceSchema], // Using new experienceSchema
  skills: [skillCategorySchema], // Using new skillCategorySchema
  projects: [projectSchema], // Using new projectSchema
  
  // Custom metadata fields
  isDraft: {
    type: Boolean,
    default: true
  },
  completionPercentage: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastAutoSaveAt: Date
});

customResumeSchema.index({ userId: 1, updatedAt: -1 });

// Update timestamp on save
customResumeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/** Legacy / imported drafts may omit subdocument `id`, which breaks required validators on save. */
customResumeSchema.pre('validate', function(next) {
  const assignId = (doc) => {
    if (doc && !doc.id) doc.id = crypto.randomUUID();
  };
  (this.educations || []).forEach(assignId);
  (this.experiences || []).forEach(assignId);
  (this.projects || []).forEach(assignId);
  (this.skills || []).forEach(assignId);
  next();
});

// Calculate completion — must match builder UI (resume-builder/builder/builder.component.ts)
customResumeSchema.methods.calculateCompletion = function() {
  const skillCount =
    (this.skills || []).reduce((sum, cat) => sum + (Array.isArray(cat?.skills) ? cat.skills.length : 0), 0) || 0;

  const checks = [
    !!(this.personal?.firstName && this.personal?.email),
    (this.educations?.length || 0) > 0,
    (this.experiences?.length || 0) > 0,
    (this.projects?.length || 0) > 0,
    skillCount >= 3,
    !!this.personal?.summary,
  ];

  this.completionPercentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export default mongoose.model("CustomResume", customResumeSchema);
