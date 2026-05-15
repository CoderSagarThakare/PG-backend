const mongoose = require('mongoose');
const config = require('./src/config/config');
const { PG, Enquiry, Bed } = require('./src/models');

async function seedBookings() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const successfulEnquiries = await Enquiry.find({ status: 'dealDone' });
    console.log(`Found ${successfulEnquiries.length} successful deals to process.`);

    for (const enquiry of successfulEnquiries) {
      const availableBed = await Bed.findOne({ 
        pgId: enquiry.pgId, 
        status: 'available',
        isDeleted: false 
      });

      if (!availableBed) {
        console.log(`No beds left in PG for enquiry ${enquiry._id}. Skipping.`);
        continue;
      }

      await Bed.findByIdAndUpdate(availableBed._id, {
        userId: enquiry.userId,
        status: 'occupied'
      });

      await PG.findByIdAndUpdate(enquiry.pgId, {
        $inc: { occupiedBeds: 1, emptyBeds: -1 }
      });

      console.log(`User ${enquiry.userId} assigned to Bed ${availableBed.bedNumber} in PG ${enquiry.pgId}`);
    }

    console.log('Success! Room and Bed assignments completed for all deals.');
  } catch (error) {
    console.error('Error seeding bookings:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedBookings();
