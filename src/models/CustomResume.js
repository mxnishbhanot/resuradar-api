import mongoose from "mongoose";

const educationSchema = new mongoose.Schema({
  school: String,
  degree: String,
  field: String,
  startYear: String,
  endYear: String,
  description: String
});

const experienceSchema = new mongoose.Schema({
  title: String,
  company: String,
  startDate: String,
  endDate: String,
  isCurrent: Boolean,
  bullets: [String]
});

const skillSchema = new mongoose.Schema({
  name: String,
  level: String
});

const projectSchema = new mongoose.Schema({
  title: String,
  link: String,
  description: String,
  tech: [String]
});

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
    summary: String
  },
  educations: [educationSchema],
  experiences: [experienceSchema],
  skills: [skillSchema],
  projects: [projectSchema],
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

// Calculate completion percentage
customResumeSchema.methods.calculateCompletion = function() {
  const checks = [
    !!(this.personal?.firstName && this.personal?.email),
    !!this.personal?.summary,
    (this.experiences?.length || 0) > 0,
    (this.educations?.length || 0) > 0,
    (this.skills?.length || 0) >= 3
  ];
  
  this.completionPercentage = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );
};

export default mongoose.model("CustomResume", customResumeSchema);