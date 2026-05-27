/**
 * migrateOnePostPerPG.js
 * ──────────────────────────────────────────────────────────────────────────────
 * For every PG that has more than one active (non-deleted) post:
 *   1. Keep the NEWEST post (latest createdAt)  ← most likely the "real" one
 *   2. Re-link all enquiries from older posts → newer post
 *      (enquiry has a unique index on {userId, postId}, so if a user already
 *       has an enquiry on the kept post we skip re-linking that duplicate)
 *   3. Soft-delete older posts (isDeleted: true, isActive: false)
 *
 * Safe to re-run — checks are idempotent.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const config   = require('./src/config/config');
const { Post, Enquiry } = require('./src/models');

async function migrate() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('✅  Connected!\n');

  // Find PGs that have 2+ active posts
  const groups = await Post.aggregate([
    { $match: { isDeleted: false } },
    { $sort:  { createdAt: -1 } },          // newest first inside each group
    { $group: {
        _id: '$pgId',
        count: { $sum: 1 },
        posts: { $push: { id: '$_id', createdAt: '$createdAt' } }
    }},
    { $match: { count: { $gt: 1 } } }
  ]);

  if (groups.length === 0) {
    console.log('✨  No duplicate posts found — nothing to do.');
    return;
  }

  console.log(`⚠️  Found ${groups.length} PG(s) with duplicate posts. Starting migration…\n`);

  for (const group of groups) {
    const pgId = group._id;
    // posts array is already sorted newest-first from $sort above
    // But aggregate $push order can vary, so re-sort explicitly
    const sorted = group.posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const [keepPost, ...oldPosts] = sorted;

    console.log(`PG ${pgId}`);
    console.log(`  ✔  Keeping  → ${keepPost.id} (${new Date(keepPost.createdAt).toISOString()})`);

    for (const old of oldPosts) {
      console.log(`  ✖  Removing → ${old.id} (${new Date(old.createdAt).toISOString()})`);

      // 1. Find all enquiries referencing the old post
      const enquiries = await Enquiry.find({ postId: old.id, isDeleted: false });
      console.log(`     → ${enquiries.length} enquirie(s) to re-link`);

      for (const enq of enquiries) {
        // Check if this user already has an enquiry on the kept post
        // (unique index: {userId, postId})
        const alreadyExists = await Enquiry.findOne({
          userId:  enq.userId,
          postId:  keepPost.id,
          isDeleted: false
        });

        if (alreadyExists) {
          // Can't re-link — would violate unique index. Soft-delete the orphan.
          console.log(`     ⚡ User ${enq.userId} already has enquiry on kept post → soft-deleting orphan enquiry ${enq._id}`);
          await Enquiry.updateOne({ _id: enq._id }, { isDeleted: true });
        } else {
          // Re-link to the kept post
          await Enquiry.updateOne({ _id: enq._id }, { $set: { postId: keepPost.id } });
          console.log(`     🔗 Re-linked enquiry ${enq._id} → post ${keepPost.id}`);
        }
      }

      // 2. Soft-delete the old post
      await Post.updateOne({ _id: old.id }, { isDeleted: true, isActive: false });
      console.log(`     🗑  Post ${old.id} soft-deleted`);
    }

    console.log('');
  }

  // Final verification
  const remaining = await Post.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$pgId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (remaining.length === 0) {
    console.log('✅  Migration complete — every PG now has at most 1 active post.');
  } else {
    console.error('❌  Some PGs still have duplicates!', remaining);
  }
}

migrate()
  .catch(err => { console.error('❌  Error:', err.message); process.exit(1); })
  .finally(() => { mongoose.connection.close(); process.exit(0); });
