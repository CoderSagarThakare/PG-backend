const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User } = require('./src/models');

async function seedOwners() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const owners = [];
    for (let i = 1; i <= 10; i++) {
      owners.push({
        name: `Test Owner ${i}`,
        email: `owner${i}@example.com`,
        password: 'Test@123',
        mobNo1: `7777777${i.toString().padStart(3, '0')}`,
        role: 'owner',
        isEmailVerified: true
      });
    }

    console.log('Inserting 10 owners...');
    for (const ownerData of owners) {
        await User.create(ownerData);
    }
    
    console.log('Success! 10 owners created.');
  } catch (error) {
    console.error('Error seeding owners:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedOwners();
