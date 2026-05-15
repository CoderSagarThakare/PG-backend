const mongoose = require('mongoose');
const config = require('./src/config/config');
const { PG, Post } = require('./src/models');
const { OCCUPANCY_TYPES } = require('./src/const/constant');

const titleKeywords = ["Premium", "Luxury", "Budget-Friendly", "Safe & Secure", "Best"];

async function seedPosts() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const pgs = await PG.find({ emptyBeds: { $gt: 0 }, isDeleted: false });
    console.log(`Found ${pgs.length} PGs with vacancies.`);

    for (const pg of pgs) {
      if (Math.random() > 0.5) {
        const title = `${titleKeywords[Math.floor(Math.random() * titleKeywords.length)]} ${pg.name}`;
        const occTypes = Object.values(OCCUPANCY_TYPES);
        
        const vacancies = Math.floor(Math.random() * pg.emptyBeds) + 1;

        await Post.create({
          pgId: pg._id,
          ownerId: pg.ownerId,
          managerId: pg.managerId,
          title: title,
          description: pg.description,
          vacancyCount: vacancies,
          address: {
            pincode: pg.address.pincode,
            city: pg.address.city
          },
          location: pg.location,
          occupancyType: occTypes[Math.floor(Math.random() * occTypes.length)],
          pgType: pg.pgType,
          pricePerBed: 5000 + Math.floor(Math.random() * 3000),
          createdBy: pg.ownerId,
          isActive: true
        });

        console.log(`Created Post for ${pg.name}`);
      }
    }

    console.log('Success! Marketplace posts are live.');
  } catch (error) {
    console.error('Error seeding posts:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedPosts();
