const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("./src/config/config");
const { User } = require("./src/models");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    // Find an owner or manager
    const staff = await User.findOne({ role: { $in: ["owner", "manager"] } });
    if (!staff) {
      console.error("No staff found in DB.");
      return;
    }

    // Generate JWT token
    const token = jwt.sign({ sub: staff._id, type: "access" }, config.jwt.secret, { expiresIn: "1h" });

    // Make request using an invalid ObjectId format
    const url = "http://localhost:8022/rent/invalid-id/approve?pgId=";
    console.log("Making POST request to:", url);
    try {
      const response = await axios.post(url, null, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log("Response:", response.data);
    } catch (err) {
      console.log("Error status code:", err.response?.status);
      console.log("Error response data:", JSON.stringify(err.response?.data, null, 2));
    }
  } catch (error) {
    console.error("Script Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

test();
