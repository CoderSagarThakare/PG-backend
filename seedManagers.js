const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User } = require('./src/models');

async function seedManagers() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const managers = [];
    for (let i = 1; i <= 20; i++) {
      managers.push({
        name: `Test Manager ${i}`,
        email: `manager${i}@example.com`,
        password: 'Test@123',
        mobNo1: `8888888${i.toString().padStart(3, '0')}`,
        role: 'manager',
        isEmailVerified: true
      });
    }

    console.log('Inserting 20 test managers...');
    for (const managerData of managers) {
        await User.create(managerData);
    }
    
    console.log('Success! 20 managers created.');
  } catch (error) {
    console.error('Error seeding managers:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedManagers();
