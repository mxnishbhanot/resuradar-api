import mongoose from "mongoose";

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
  major: { type: String, required: true }, // Changed from 'field'
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

// Update timestamp on save
customResumeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate completion percentage (Adjusted for new schema structure)
customResumeSchema.methods.calculateCompletion = function() {
  const checks = [
    !!(this.personal?.firstName && this.personal?.email), // Contact Info
    !!this.personal?.summary, // Summary
    (this.experiences?.length || 0) > 0, // Experience
    (this.educations?.length || 0) > 0, // Education
    (this.projects?.length || 0) > 0, // Projects
    (this.skills?.length || 0) > 0 // Skills (checking if at least one category exists)
  ];
  
  this.completionPercentage = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );
};

export default mongoose.model("CustomResume", customResumeSchema);