const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User, PG } = require('./src/models');
const { PG_TYPES } = require('./src/const/constant');

const locations = [
  { city: 'Mumbai', state: 'Maharashtra', coords: [72.8777, 19.0760], pincode: 400001 },
  { city: 'Pune', state: 'Maharashtra', coords: [73.8567, 18.5204], pincode: 411001 },
  { city: 'Bangalore', state: 'Karnataka', coords: [77.5946, 12.9716], pincode: 560001 },
  { city: 'Delhi', state: 'Delhi', coords: [77.2090, 28.6139], pincode: 110001 }
];

const descriptions = [
  "Modern living space with all premium amenities.",
  "Quiet and peaceful environment perfect for students.",
  "Luxury stay with high-speed internet and daily cleaning.",
  "Affordable and secure housing for working professionals."
];

async function seedPGs() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const owners = await User.find({ role: 'owner' });
    const managers = await User.find({ role: 'manager' });

    if (owners.length === 0 || managers.length === 0) {
      console.log('Error: Please run seedOwners.js and seedManagers.js first!');
      return;
    }

    console.log(`Found ${owners.length} owners and ${managers.length} managers.`);

    for (const owner of owners) {
      const pgCount = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
      console.log(`Creating ${pgCount} PGs for owner: ${owner.name}`);

      for (let i = 1; i <= pgCount; i++) {
        const randomManager = managers[Math.floor(Math.random() * managers.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const types = Object.values(PG_TYPES);

        await PG.create({
          ownerId: owner._id,
          managerId: randomManager._id,
          name: `${owner.name}'s Premium Stay ${i}`,
          pgType: types[Math.floor(Math.random() * types.length)],
          description: descriptions[Math.floor(Math.random() * descriptions.length)],
          address: {
            pincode: loc.pincode + i,
            landmark: 'Near Metro Station',
            city: loc.city,
            state: loc.state,
            country: 'India'
          },
          location: {
            type: "Point",
            coordinates: loc.coords
          },
          totalRooms: 0,
          totalBeds: 0,
          isActive: true
        });
      }
    }

    console.log('Success! Advanced PG data generated.');
  } catch (error) {
    console.error('Error seeding PGs:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedPGs();
