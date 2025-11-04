import Contact from "../models/Contact.js";

export const submitContact = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Simple validation
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Save contact
    const newContact = new Contact({ name, email, message });
    await newContact.save();

    res.status(200).json({
      success: true,
      message: "Your message has been received. We'll get back to you soon!",
    });
  } catch (error) {
    console.error("Contact form submission error:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};