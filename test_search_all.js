const mongoose = require("mongoose");
const config = require("./src/config/config");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    const targetIdStr = "6a10b724e1ddd27e1155796e";
    const targetObjectId = new mongoose.Types.ObjectId(targetIdStr);
    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const col of collections) {
      const cursor = mongoose.connection.db.collection(col.name).find({});
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        // Check if targetIdStr is in the document
        const docStr = JSON.stringify(doc);
        if (docStr.includes(targetIdStr)) {
          console.log(`FOUND in collection [${col.name}] (contains string):`, JSON.stringify(doc, null, 2));
          return;
        }
      }
    }
    console.log("ID 6a10b724e1ddd27e1155796e not found anywhere in any collection.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

test();
