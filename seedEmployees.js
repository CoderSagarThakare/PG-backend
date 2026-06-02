const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User } = require('./src/models');

// Indian first names and last names for realistic dummy data
const firstNames = [
  'Aarav', 'Arjun', 'Vikram', 'Rohan', 'Karan', 'Rahul', 'Amit', 'Sanjay', 'Deepak', 'Nikhil',
  'Priya', 'Neha', 'Anjali', 'Pooja', 'Sneha', 'Meera', 'Divya', 'Kavya', 'Simran', 'Riya',
  'Suresh', 'Mahesh', 'Ganesh', 'Ramesh', 'Dinesh', 'Rajesh', 'Naresh', 'Manish', 'Harish', 'Girish',
  'Isha', 'Tanya', 'Shruti', 'Swati', 'Sonali', 'Rekha', 'Seema', 'Geeta', 'Nisha', 'Komal',
  'Akash', 'Ankit', 'Vishal', 'Gaurav', 'Shubham', 'Ravi', 'Aditya', 'Mohit', 'Sachin', 'Yash'
];

const lastNames = [
  'Sharma', 'Verma', 'Singh', 'Gupta', 'Patel', 'Kumar', 'Joshi', 'Shah', 'Mehta', 'Yadav',
  'Nair', 'Iyer', 'Reddy', 'Rao', 'Pillai', 'Bhat', 'Kaur', 'Malhotra', 'Kapoor', 'Agarwal',
  'Tiwari', 'Pandey', 'Mishra', 'Dubey', 'Shukla', 'Bose', 'Chandra', 'Das', 'Jain', 'Saxena'
];

const cities = ['Mumbai', 'Pune', 'Bangalore', 'Hyderabad', 'Chennai', 'Delhi', 'Ahmedabad', 'Surat'];
const states = ['Maharashtra', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Delhi', 'Gujarat'];

async function seedEmployees() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('✅ Connected!\n');

    let created = 0;
    let skipped = 0;

    console.log('🌱 Seeding 50 dummy employees...\n');

    for (let i = 1; i <= 50; i++) {
      const firstName = firstNames[i - 1];
      const lastName = lastNames[i % lastNames.length];
      const fullName = `${firstName} ${lastName}`;
      const email = `employee${i}@example.com`;
      const mobNo1 = `9${String(800000000 + i).slice(0, 9)}`; // 10 digits starting with 9

      // Check if already exists to avoid duplicate error
      const exists = await User.findOne({ email });
      if (exists) {
        console.log(`  ⚠️  Skipping #${i}: ${email} already exists`);
        skipped++;
        continue;
      }

      await User.create({
        name: fullName,
        email,
        password: 'Test@123',
        mobNo1,
        role: 'employee',
        isEmailVerified: true,
        gender: i % 2 === 0 ? 'male' : 'female',
        address: {
          city: cities[i % cities.length],
          state: states[i % states.length],
          country: 'India',
          pincode: 400000 + (i * 11),
          locationDescription: `${i * 12} Main Road, Sector ${i}`,
          landmark: `Near City Mall ${i}`,
        }
      });

      console.log(`  ✅ #${i.toString().padStart(2, '0')} Created: ${fullName} (${email})`);
      created++;
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`🎉 Done! ${created} employees created, ${skipped} skipped (already existed).`);
    console.log(`\n📋 Login with any of these accounts:`);
    console.log(`   Email:    employee1@example.com  →  employee50@example.com`);
    console.log(`   Password: Test@123`);
    console.log(`   Role:     employee`);
    console.log(`${'─'.repeat(50)}\n`);

  } catch (error) {
    console.error('❌ Error seeding employees:', error.message);
    if (error.errors) {
      Object.entries(error.errors).forEach(([field, err]) => {
        console.error(`   Field "${field}": ${err.message}`);
      });
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB connection closed.');
    process.exit(0);
  }
}

seedEmployees();
