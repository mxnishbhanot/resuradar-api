import crypto from "crypto";

const ensureId = (value) => value || crypto.randomUUID();

const splitBullets = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizePersonal = (personal = {}) => ({
  firstName: personal.firstName || "",
  lastName: personal.lastName || "",
  email: personal.email || "",
  phone: personal.phone || "",
  location: personal.location || "",
  headline: personal.headline || "",
  summary: personal.summary || "",
  linkedin: personal.linkedin || "",
  github: personal.github || "",
  portfolioUrl: personal.portfolioUrl || personal.portfolio || personal.website || "",
});

export const normalizeParsedResume = (parsed = {}) => {
  const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
  const skillNames = skills
    .map((skill) => skill?.name || skill)
    .map((skill) => String(skill || "").trim())
    .filter(Boolean);

  return {
    personal: normalizePersonal(parsed.personal),
    educations: (Array.isArray(parsed.educations) ? parsed.educations : []).map((education) => ({
      id: ensureId(education.id),
      institution: education.institution || education.school || "",
      degree: education.degree || "",
      major: education.major || education.field || "",
      startDate: education.startDate || education.startYear || "",
      endDate: education.endDate || education.endYear || "",
      isCurrent: Boolean(education.isCurrent),
      gpa: education.gpa || "",
      bullets: splitBullets(education.bullets || education.description),
    })),
    experiences: (Array.isArray(parsed.experiences) ? parsed.experiences : []).map((experience) => ({
      id: ensureId(experience.id),
      title: experience.title || "",
      company: experience.company || "",
      startDate: experience.startDate || "",
      endDate: experience.endDate || "",
      isCurrent: Boolean(experience.isCurrent),
      bullets: splitBullets(experience.bullets || experience.description),
      role: experience.role || "",
      link: experience.link || "",
    })),
    skills: skillNames.length
      ? [{ id: ensureId("core-skills"), name: "Core Skills", skills: skillNames }]
      : [],
    projects: (Array.isArray(parsed.projects) ? parsed.projects : []).map((project) => ({
      id: ensureId(project.id),
      title: project.title || "",
      role: project.role || "",
      link: project.link || "",
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      isCurrent: Boolean(project.isCurrent),
      techStack: Array.isArray(project.techStack) ? project.techStack : Array.isArray(project.tech) ? project.tech : [],
      bullets: splitBullets(project.bullets || project.description),
    })),
  };
};
