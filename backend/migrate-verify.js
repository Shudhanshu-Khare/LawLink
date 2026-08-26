// backend/migrate-verify.js
// One-time migration: Sets isVerified=true for all existing users
// Run: node backend/migrate-verify.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await User.updateMany(
    { isVerified: { $ne: true } },
    { $set: { isVerified: true } }
  );

  console.log(`✅ Migration complete: ${result.modifiedCount} users set to isVerified=true`);
  
  // Also ensure admin exists
  const adminEmail = 'khareshudhanshu247@gmail.com';
  const admin = await User.findOne({ email: adminEmail });
  if (admin) {
    admin.role = 'admin';
    admin.isVerified = true;
    admin.isBlocked = false;
    await admin.save();
    console.log(`✅ Admin role assigned to ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin account (${adminEmail}) not found — it will be created on first Google Sign-In`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

migrate().catch(err => { console.error(err); process.exit(1); });
