const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User } = require('./src/models');

async function seedData() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const users = [];
    for (let i = 1; i <= 100; i++) {
      users.push({
        name: `Test User ${i}`,
        email: `testuser${i}@example.com`,
        password: 'Test@123',
        mobNo1: `9876543${i.toString().padStart(3, '0')}`, // Added required field
        role: 'user',
        isEmailVerified: true
      });
    }

    console.log('Inserting 100 test users...');
    // We use insertMany for speed, but note that it doesn't run some mongoose hooks.
    // If you need the password to be hashed (which the User model usually does in 'pre-save'),
    // we should create them one by one or use a hashing library here.
    // However, since your User model has a pre-save hook for hashing, 
    // let's create them in a way that triggers it.
    
    for (const userData of users) {
        await User.create(userData);
    }
    
    console.log('Success! 100 users created.');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedData();
