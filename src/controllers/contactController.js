import Contact from "../models/Contact.js";
import { ensureEmail, ensureString } from "../utils/validation.js";

export const submitContact = async (req, res) => {
  try {
    const name = ensureString(req.body?.name, "name", { max: 120 });
    const email = ensureEmail(req.body?.email);
    const message = ensureString(req.body?.message, "message", { max: 2000 });
    const website = typeof req.body?.website === "string" ? req.body.website.trim() : "";

    if (website) {
      return res.status(200).json({
        success: true,
        message: "Your message has been received. We'll get back to you soon!",
      });
    }

    const newContact = new Contact({ name, email, message });
    await newContact.save();

    res.status(200).json({
      success: true,
      message: "Your message has been received. We'll get back to you soon!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
