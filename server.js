import dotenv from "dotenv";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";

dotenv.config();

// Connect to database
(async () => {
  try {
    await connectDB();
    console.log("✅ Database connected successfully");

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1); // Exit on fatal error
  }
})();
