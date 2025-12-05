import CustomResume from "../models/CustomResume.js";
import { parseResumeToSchema } from "../services/aiService.js";
import { PDFParse } from "pdf-parse";
import mammoth from 'mammoth';
import { renderTemplateHTML } from "../services/template-engine.js";

// Note: getCustomResumeDraft is now redundant as the client should use
// getCustomResume(id) or startNewResume(). I will remove its logic.
export const getCustomResumeDraft = async (req, res) => {
    // This endpoint is now deprecated in favor of using the ID-specific endpoint.
    // If called, it should load the latest draft, but the frontend should be updated 
    // to primarily use /:id or the new flow.
    try {
        let resume = await CustomResume.findOne({
            userId: req.user.userId,
            isDraft: true
        }).sort({ updatedAt: -1 });

        if (!resume) {
            return res.json({ resume: null, message: "No active draft found." });
        }
        res.json({ resume });
    } catch (error) {
        console.error('Get draft error:', error);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
};

// Auto-save draft (throttled on frontend)
// CRITICAL FIX: Now accepts _id in the body. If _id is present, it updates. If not, it creates new.
export const autoSaveCustomResumeDraft = async (req, res) => {
    try {
        const { _id, personal, educations, experiences, skills, projects } = req.body;

        let resume;

        if (_id) {
            // Attempt to find the specific document by ID
            resume = await CustomResume.findOne({
                _id,
                userId: req.user.userId,
            });

            if (!resume) {
                // This means the ID was invalid or deleted. Create a new one.
                console.warn(`Resume ID ${_id} not found for user ${req.user.userId}. Creating new draft.`);
                resume = new CustomResume({ userId: req.user.userId, isDraft: true });
            }
        } else {
            // No ID provided: This is a brand new session/resume, so create a new document
            resume = new CustomResume({ userId: req.user.userId, isDraft: true });
        }

        // Update fields
        if (personal) resume.personal = personal;
        if (educations) resume.educations = educations;
        if (experiences) resume.experiences = experiences;
        if (skills) resume.skills = skills;
        if (projects) resume.projects = projects;

        // Ensure it's marked as a draft whenever auto-save runs
        resume.isDraft = true; 
        
        resume.lastAutoSaveAt = new Date();
        resume.calculateCompletion();
        await resume.save();

        res.json({
            message: 'Draft auto-saved',
            resume, // CRITICAL: Return the full resume object, including the _id (especially when new)
            savedAt: resume.lastAutoSaveAt
        });
    } catch (error) {
        console.error('Auto-save error:', error);
        res.status(500).json({ error: 'Failed to auto-save draft' });
    }
};

// Save complete resume (Manual Save)
export const saveCustomResume = async (req, res) => {
    try {
        const { _id, personal, educations, experiences, skills, projects, isDraft } = req.body;
        
        let resume;
        if (_id) {
            // Update existing document if ID is provided
            resume = await CustomResume.findOne({ _id, userId: req.user.userId });
            if (!resume) {
                return res.status(404).json({ error: 'Resume not found for save' });
            }
        } else {
            // Create new document if no ID is provided
            resume = new CustomResume({ userId: req.user.userId });
        }

        resume.personal = personal;
        resume.educations = educations || [];
        resume.experiences = experiences || [];
        resume.skills = skills || [];
        resume.projects = projects || [];
        // Set isDraft based on the request (e.g., false for final save, true for "save as draft")
        resume.isDraft = isDraft !== undefined ? isDraft : false; 

        resume.calculateCompletion();
        await resume.save();

        res.json({
            message: 'Resume saved successfully',
            resume
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save resume' });
    }
};

// Get all user's resumes
export const fetchAllCustomResumes = async (req, res) => {
    try {
        const resumes = await CustomResume.find({ userId: req.user.userId })
            .sort({ updatedAt: -1 })
            .select('-__v');

        res.json({ resumes });
    } catch (error) {
        console.error('Get all resumes error:', error);
        res.status(500).json({ error: 'Failed to fetch resumes' });
    }
};

// Get specific resume (used by the frontend to load by ID)
export const getCustomResume = async (req, res) => {
    try {
        const resume = await CustomResume.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        res.json({ resume });
    } catch (error) {
        console.error('Get resume error:', error);
        res.status(500).json({ error: 'Failed to fetch resume' });
    }
};

// Update Resume (This is often redundant since auto-save handles PUTs, but kept for completeness)
export const updateCustomResume = async (req, res) => {
    try {
        const resume = await CustomResume.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const { personal, educations, experiences, skills, projects, isDraft } = req.body;

        if (personal) resume.personal = personal;
        if (educations) resume.educations = educations;
        if (experiences) resume.experiences = experiences;
        if (skills) resume.skills = skills;
        if (projects) resume.projects = projects;
        if (isDraft !== undefined) resume.isDraft = isDraft;

        resume.calculateCompletion();
        await resume.save();

        res.json({
            message: 'Resume updated successfully',
            resume
        });
    } catch (error) {
        console.error('Update resume error:', error);
        res.status(500).json({ error: 'Failed to update resume' });
    }
};

// Delete resume
export const deleteCustomResume = async (req, res) => {
    try {
        const resume = await CustomResume.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        res.json({ message: 'Resume deleted successfully' });
    } catch (error) {
        console.error('Delete resume error:', error);
        res.status(500).json({ error: 'Failed to delete resume' });
    }
};

// Duplicate resume
export const duplicateCustomResume = async (req, res) => {
    try {
        const original = await CustomResume.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!original) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Create a new document with the same data
        const duplicate = new CustomResume({
            userId: req.user.userId,
            personal: original.personal,
            educations: original.educations,
            experiences: original.experiences,
            skills: original.skills,
            projects: original.projects,
            isDraft: true // New copy is explicitly a draft
        });

        duplicate.calculateCompletion();
        await duplicate.save();

        res.json({
            message: 'Resume duplicated successfully',
            resume: duplicate // Return the new document
        });
    } catch (error) {
        console.error('Duplicate resume error:', error);
        res.status(500).json({ error: 'Failed to duplicate resume' });
    }
};

// Mark resume as complete
export const completeCustomResume = async (req, res) => {
    try {
        const resume = await CustomResume.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        resume.isDraft = false;
        resume.calculateCompletion();
        await resume.save();

        res.json({
            message: 'Resume marked as complete',
            resume
        });
    } catch (error) {
        console.error('Complete resume error:', error);
        res.status(500).json({ error: 'Failed to complete resume' });
    }
};

export const uploadCustomResume = async (req, res) => {
    // ... (same as original, but returns the new _id and resume object)
    try {
        if (!req.file || !req.user.userId) {
            return res.status(400).json({ error: 'File and authentication required' });
        }

        let rawText = '';
        if (req.file.mimetype === 'application/pdf') {
            const data = new PDFParse({ url: req.file.path });
            const result = await data.getText()

            rawText = result.text;
        } else if (
            req.file.mimetype.includes('wordprocessing') ||
            req.file.mimetype === 'application/msword'
        ) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            rawText = result.value;
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        if (!rawText.trim()) {
            return res.status(400).json({ error: 'Empty or unreadable resume file' });
        }

        // ✅ Parse with your AI — same as analyzer!
        console.log({rawText});
        
        const structuredData = await parseResumeToSchema(rawText);
        console.log({structuredData});
        
        // Create & save
        const newResume = new CustomResume({
            userId: req.user.userId,
            ...structuredData,
            isDraft: true
        });

        newResume.calculateCompletion();
        await newResume.save();

        // Return state for frontend
        const resumeState = {
            _id: newResume._id, // CRITICAL: Include the new ID
            personal: newResume.personal || {},
            educations: newResume.educations || [],
            experiences: newResume.experiences || [],
            skills: newResume.skills || [],
            projects: newResume.projects || []
        };

        res.json({
            success: true,
            resume: resumeState,
            id: newResume._id
        });

    } catch (error) {
        console.error('Upload parsing error:', error);
        res.status(500).json({ error: 'AI failed to parse resume. Try a clearer PDF.' });
    }
};

export const previewResumeController = async (req, res) => {
  try {
    const { template, resumeId } = req.params;

    if (!template || !resumeId) {
      return res.status(400).json({ message: "Template and Resume ID are required" });
    }

    const resume = await CustomResume.findOne({
      _id: resumeId,
      userId: req.user.userId
    });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Convert to clean plain object
    const cleanData = JSON.parse(JSON.stringify(resume));

    // Generate HTML (same as PDF)
    const html = await renderTemplateHTML(cleanData, template);

    res.set("Content-Type", "text/html");
    return res.send(html);

  } catch (err) {
    console.error("Preview Error:", err);
    return res.status(500).json({ message: "Failed to generate preview" });
  }
};