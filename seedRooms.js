const mongoose = require('mongoose');
const config = require('./src/config/config');
const { PG, Room, Bed } = require('./src/models');

async function seedRooms() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const pgs = await PG.find({ isDeleted: false });
    console.log(`Found ${pgs.length} PGs to add rooms and beds to.`);

    for (const pg of pgs) {
      let pgTotalRooms = 0;
      let pgTotalBeds = 0;

      const floors = Math.floor(Math.random() * 3) + 1;

      for (let f = 1; f <= floors; f++) {
        const roomsPerFloor = Math.floor(Math.random() * 4) + 1;

        for (let r = 1; r <= roomsPerFloor; r++) {
          const sharing = Math.floor(Math.random() * 3) + 1; // 1 to 3 sharing
          const roomNo = `${f}0${r}`;
          const isAC = Math.random() > 0.5 ? "AC" : "Non-AC";

          // 1. Create the Room
          const room = await Room.create({
            pgId: pg._id,
            roomNumber: roomNo,
            floor: f,
            sharingType: sharing,
            roomType: isAC
          });

          // 2. Create the Beds for this room
          for (let b = 0; b < sharing; b++) {
            const bedLetter = String.fromCharCode(65 + b); // A, B, C...
            await Bed.create({
              roomId: room._id,
              pgId: pg._id,
              bedNumber: `${roomNo}-${bedLetter}`,
              price: isAC === "AC" ? 6500 : 5000,
              position: b === 0 ? "Window Side" : "Near Door",
              status: "available"
            });
            pgTotalBeds++;
          }

          pgTotalRooms++;
        }
      }

      // 3. Update the PG with the new totals
      await PG.findByIdAndUpdate(pg._id, {
        totalRooms: pgTotalRooms,
        totalBeds: pgTotalBeds,
        emptyBeds: pgTotalBeds,
        occupiedBeds: 0
      });

      console.log(`Added ${pgTotalRooms} rooms and ${pgTotalBeds} beds to ${pg.name}`);
    }

    console.log('Success! Room and Bed data generated.');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedRooms();
