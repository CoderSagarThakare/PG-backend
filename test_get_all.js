const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("./src/config/config");
const { User } = require("./src/models");

async function test() {
  try {
    console.log("Connecting to MongoDB to get staff...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    const staff = await User.findOne({ role: { $in: ["owner", "manager"] } });
    await mongoose.disconnect();

    if (!staff) {
      console.error("No staff found.");
      return;
    }

    const token = jwt.sign({ sub: staff._id, type: "access" }, config.jwt.secret, { expiresIn: "1h" });
    const url = "http://localhost:8022/rent";
    console.log("Fetching rent payments from running backend server...");
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const records = response.data?.data?.records || [];
    console.log(`Fetched ${records.length} records from server.`);
    const found = records.find(r => r._id === "6a10b724e1ddd27e1155796e");
    if (found) {
      console.log("FOUND matching rent payment on server:", JSON.stringify(found, null, 2));
    } else {
      console.log("Rent payment 6a10b724e1ddd27e1155796e NOT found on server list.");
      console.log("Server records:");
      records.forEach(r => console.log(`ID: ${r._id}, Status: ${r.status}, Month: ${r.rentMonth}`));
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

test();
