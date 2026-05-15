const mongoose = require('mongoose');
const config = require('./src/config/config');
const { User, Post, Enquiry } = require('./src/models');

const statuses = ["interested", "contacted", "visited", "dealDone", "rejected"];
const userRemarks = [
  "Is parking available?", 
  "I want to visit tomorrow morning.", 
  "Looking for a shared room.", 
  "Please call me back."
];

async function seedEnquiries() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected!');

    const users = await User.find({ role: 'user' }).limit(50); 
    const posts = await Post.find({ isDeleted: false });

    if (users.length === 0 || posts.length === 0) {
      console.log('Error: Please run seedUsers.js and seedPosts.js first!');
      return;
    }

    console.log(`Generating enquiries for ${users.length} users across ${posts.length} posts...`);

    for (const user of users) {
      const enquiryCount = Math.floor(Math.random() * 3) + 1;
      const shuffledPosts = [...posts].sort(() => 0.5 - Math.random());
      const selectedPosts = shuffledPosts.slice(0, enquiryCount);

      for (const post of selectedPosts) {
        try {
          await Enquiry.create({
            userId: user._id,
            pgId: post.pgId,
            postId: post._id,
            ownerId: post.ownerId,
            managerId: post.managerId,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            userRemark: userRemarks[Math.floor(Math.random() * userRemarks.length)]
          });
        } catch (err) {
          continue;
        }
      }
    }

    console.log('Success! Enquiries generated.');
  } catch (error) {
    console.error('Error seeding enquiries:', error);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

seedEnquiries();
