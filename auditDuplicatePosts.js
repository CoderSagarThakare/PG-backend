const mongoose = require('mongoose');
const config = require('./src/config/config');
const { Post, Enquiry } = require('./src/models');

async function audit() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected!\n');

  const dupes = await Post.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$pgId', count: { $sum: 1 }, posts: { $push: { id: '$_id', createdAt: '$createdAt', vacancyCount: '$vacancyCount', pgType: '$pgType' } } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log('PGs with duplicate active posts:', dupes.length);
  for (const d of dupes) {
    console.log('  pgId:', d._id, '  count:', d.count);
    d.posts.forEach(p => console.log('    postId:', p.id, '  vacancyCount:', p.vacancyCount, '  pgType:', p.pgType, '  createdAt:', p.createdAt));
  }

  const total = await Post.countDocuments({ isDeleted: false });
  const uniquePGs = await Post.distinct('pgId', { isDeleted: false });
  console.log('\nTotal active posts:', total);
  console.log('Unique PGs with posts:', uniquePGs.length);
}

audit().catch(e => { console.error(e); process.exit(1); }).finally(() => { mongoose.connection.close(); process.exit(0); });
