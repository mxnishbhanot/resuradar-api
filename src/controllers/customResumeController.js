import CustomResume from "../models/CustomResume.js";
import { parseResumeToSchema } from "../services/aiService.js";
import { PDFParse } from "pdf-parse";
import mammoth from 'mammoth';

// Get user's draft resume or create new one
export const getCustomResumeDraft = async (req, res) => {
    try {
        let resume = await CustomResume.findOne({
            userId: req.user.userId,
            isDraft: true
        }).sort({ updatedAt: -1 });

        if (!resume) {
            // Create new draft
            resume = new CustomResume({
                userId: req.user.userId,
                isDraft: true,
                personal: {},
                educations: [],
                experiences: [],
                skills: [],
                projects: []
            });
            await resume.save();
        }

        res.json({ resume });
    } catch (error) {
        console.error('Get draft error:', error);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
};

// Auto-save draft (throttled on frontend)
export const autoSaveCustomResumeDraft = async (req, res) => {
    try {
        const { personal, educations, experiences, skills, projects } = req.body;

        let resume = await CustomResume.findOne({
            userId: req.user.userId,
            isDraft: true
        });

        if (!resume) {
            resume = new CustomResume({ userId: req.user.userId, isDraft: true });
        }

        // Update fields
        if (personal) resume.personal = personal;
        if (educations) resume.educations = educations;
        if (experiences) resume.experiences = experiences;
        if (skills) resume.skills = skills;
        if (projects) resume.projects = projects;

        resume.lastAutoSaveAt = new Date();
        resume.calculateCompletion();
        await resume.save();

        res.json({
            message: 'Draft auto-saved',
            resume,
            savedAt: resume.lastAutoSaveAt
        });
    } catch (error) {
        console.error('Auto-save error:', error);
        res.status(500).json({ error: 'Failed to auto-save draft' });
    }
};

// Save complete resume
export const saveCustomResume = async (req, res) => {
    try {
        const { personal, educations, experiences, skills, projects, isDraft } = req.body;

        let resume = await CustomResume.findOne({
            userId: req.user.userId,
            isDraft: true
        });

        if (!resume) {
            resume = new CustomResume({ userId: req.user.userId });
        }

        resume.personal = personal;
        resume.educations = educations || [];
        resume.experiences = experiences || [];
        resume.skills = skills || [];
        resume.projects = projects || [];
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

// Get specific resume
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

// Update Resume
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

        const duplicate = new CustomResume({
            userId: req.user.userId,
            personal: original.personal,
            educations: original.educations,
            experiences: original.experiences,
            skills: original.skills,
            projects: original.projects,
            isDraft: true
        });

        duplicate.calculateCompletion();
        await duplicate.save();

        res.json({
            message: 'Resume duplicated successfully',
            resume: duplicate
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
