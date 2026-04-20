/**
 * Read-only: find users by email regex and print custom resume summary.
 * Usage (from resuradar-api): node scripts/inspect-user-resumes.mjs [emailSubstring]
 * Requires MONGO_URI in .env or environment.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const substring = process.argv[2] || "manukondal20";

function summarizeNested(doc) {
  const issues = [];
  const checkArr = (arr, name, requiredKeys) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item, i) => {
      for (const k of requiredKeys) {
        if (item[k] === undefined || item[k] === null || item[k] === "") {
          issues.push(`${name}[${i}].${k} missing or empty`);
        }
      }
    });
  };
  checkArr(doc.educations, "educations", ["id", "institution", "degree", "major"]);
  checkArr(doc.experiences, "experiences", ["id", "title"]);
  checkArr(doc.projects, "projects", ["id", "title"]);
  checkArr(doc.skills, "skills", ["id", "name"]);
  return issues.slice(0, 20);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const users = await db
    .collection("users")
    .find({ email: { $regex: new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } })
    .project({ email: 1, googleId: 1, name: 1 })
    .toArray();

  console.log(JSON.stringify({ userCount: users.length, users }, null, 2));

  for (const u of users) {
    const uid = u._id;
    const resumes = await db
      .collection("customresumes")
      .find({ userId: uid })
      .sort({ updatedAt: -1 })
      .toArray();

    const draftCount = resumes.filter((r) => r.isDraft).length;

    const summaries = resumes.map((r) => ({
      _id: String(r._id),
      isDraft: r.isDraft,
      completionPercentage: r.completionPercentage,
      updatedAt: r.updatedAt,
      lastAutoSaveAt: r.lastAutoSaveAt,
      nestedIssues: summarizeNested(r),
    }));

    console.log(
      JSON.stringify(
        {
          userId: String(uid),
          resumeCount: resumes.length,
          draftCount,
          resumes: summaries,
        },
        null,
        2
      )
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
