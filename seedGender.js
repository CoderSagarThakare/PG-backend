/**
 * seedGender.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Assigns a random gender to every existing User document that doesn't
 * already have one set.
 *
 * Run:  node seedGender.js
 *
 * Options (env vars):
 *   GENDER_DIST=40,40,10,10   - percentage distribution for
 *                               male, female, transgender, preferNotToSay
 *                               (must sum to 100, default: 48,48,2,2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const config   = require('./src/config/config');
const { User } = require('./src/models');

const GENDER_VALUES = ['male', 'female', 'transgender', 'preferNotToSay'];

// Parse distribution from env or use sensible defaults
function buildWeights() {
  const raw = process.env.GENDER_DIST;
  if (raw) {
    const parts = raw.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.warn('⚠️  Invalid GENDER_DIST — using default distribution');
    } else {
      return parts;
    }
  }
  return [48, 48, 2, 2]; // male 48 %, female 48 %, trans 2 %, pns 2 %
}

function pickGender(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand < 0) return GENDER_VALUES[i];
  }
  return GENDER_VALUES[0];
}

async function seedGender() {
  console.log('🔗  Connecting to database…');
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('✅  Connected!\n');

  const weights = buildWeights();
  console.log(`📊  Gender distribution: male=${weights[0]}%  female=${weights[1]}%  transgender=${weights[2]}%  preferNotToSay=${weights[3]}%\n`);

  // Only touch users without a gender (so re-running is safe)
  const users = await User.find({ gender: { $exists: false }, isDeleted: false });
  console.log(`👥  Found ${users.length} user(s) without a gender field.`);

  if (users.length === 0) {
    console.log('✨  Nothing to update — all users already have a gender!');
    return;
  }

  const tally = { male: 0, female: 0, transgender: 0, preferNotToSay: 0 };
  let updated = 0;

  for (const user of users) {
    const gender = pickGender(weights);
    await User.updateOne({ _id: user._id }, { $set: { gender } });
    tally[gender]++;
    updated++;
    if (updated % 50 === 0) {
      process.stdout.write(`  ↳ Updated ${updated}/${users.length}…\r`);
    }
  }

  console.log(`\n\n✅  Done! Updated ${updated} user(s).`);
  console.log('📈  Final tally:');
  Object.entries(tally).forEach(([g, n]) => console.log(`    ${g.padEnd(16)} ${n}`));
}

seedGender()
  .catch(err => { console.error('❌  Error:', err.message); process.exit(1); })
  .finally(() => { mongoose.connection.close(); process.exit(0); });
