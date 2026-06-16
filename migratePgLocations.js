const mongoose = require('mongoose');
const config   = require('./src/config/config');
const { PG }   = require('./src/models');

// Mapping of standard Indian cities to coordinates [longitude, latitude]
const cityCoordinates = {
  mumbai: [72.8777, 19.0760],
  pune: [73.8567, 18.5204],
  bangalore: [77.5946, 12.9716],
  bengaluru: [77.5946, 12.9716],
  delhi: [77.2090, 28.6139],
  newdelhi: [77.2090, 28.6139],
  chennai: [80.2707, 13.0827],
  hyderabad: [78.4867, 17.3850],
  kolkata: [88.3639, 22.5726],
  ahmedabad: [72.5714, 23.0225],
  jaipur: [75.7873, 26.9124]
};

async function migrateLocations() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('✅ Connected to MongoDB!');

  const pgs = await PG.find({ isDeleted: false });
  console.log(`Found ${pgs.length} PG records. Migrating coordinates...`);

  let updatedCount = 0;

  for (const pg of pgs) {
    const coords = pg.location?.coordinates;
    const isDefaultOrEmpty = !coords || coords.length !== 2 || (coords[0] === 0 && coords[1] === 0);

    if (isDefaultOrEmpty) {
      const city = (pg.address?.city || '').trim().toLowerCase();
      let defaultCoords = cityCoordinates[city];

      if (!defaultCoords) {
        // Fallback: search for partial matches
        const matchedCity = Object.keys(cityCoordinates).find(k => city.includes(k));
        if (matchedCity) {
          defaultCoords = cityCoordinates[matchedCity];
        }
      }

      // If still not matched, use a default fallback (e.g. Pune/Mumbai coordinates)
      if (!defaultCoords) {
        console.log(`⚠️ City "${pg.address?.city}" not in mapping for PG "${pg.name}". Using Pune coordinates fallback.`);
        defaultCoords = cityCoordinates.pune;
      }

      // Apply a small random offset (approx. +/- 500m to 1km) so they don't stack directly on top of each other
      const offsetLng = (Math.random() - 0.5) * 0.015;
      const offsetLat = (Math.random() - 0.5) * 0.015;

      const finalCoords = [
        Math.round((defaultCoords[0] + offsetLng) * 1000000) / 1000000,
        Math.round((defaultCoords[1] + offsetLat) * 1000000) / 1000000
      ];

      // Assign the GeoJSON Point structure
      pg.location = {
        type: 'Point',
        coordinates: finalCoords
      };

      await pg.save();
      updatedCount++;
      console.log(`Updated PG "${pg.name}" (${pg._id}) located in "${pg.address?.city}" with coordinates ${JSON.stringify(finalCoords)}`);
    } else {
      console.log(`ℹ️ PG "${pg.name}" (${pg._id}) already has valid coordinates: ${JSON.stringify(coords)}`);
    }
  }

  console.log(`✅ Migration completed! Updated ${updatedCount} PG records.`);
}

migrateLocations()
  .catch(err => { console.error('❌ Error during migration:', err.message); process.exit(1); })
  .finally(() => { mongoose.connection.close(); process.exit(0); });
