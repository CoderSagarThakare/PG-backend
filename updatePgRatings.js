const mongoose = require('mongoose');
const config   = require('./src/config/config');
const { PG }   = require('./src/models');

async function updateRatings() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('✅ Connected to MongoDB!');

  const pgs = await PG.find({ isDeleted: false });
  console.log(`Found ${pgs.length} PG records. Updating ratings...`);

  for (const pg of pgs) {
    // Generate random float between 0.0 and 5.0, rounded to 1 decimal place
    const rating = Math.round((Math.random() * 5) * 10) / 10;
    pg.rating = rating;
    await pg.save();
    console.log(`Updated PG "${pg.name}" (${pg._id}) rating to ${rating}`);
  }

  console.log('✅ All PG ratings updated successfully!');
}

updateRatings()
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); })
  .finally(() => { mongoose.connection.close(); process.exit(0); });
