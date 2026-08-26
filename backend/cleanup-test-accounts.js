// backend/cleanup-test-accounts.js
// Removes all test accounts EXCEPT priya@lawlink.com and rahul@lawlink.com
// Run: node backend/cleanup-test-accounts.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');
const Case = require('./models/Case.model');
const Consultation = require('./models/Consultation.model');
const LegalDocument = require('./models/LegalDocument.model');
const Invoice = require('./models/Invoice.model');
const Deadline = require('./models/Deadline.model');
const Conversation = require('./models/Conversation.model');
const Message = require('./models/Message.model');

const KEEP_EMAILS = ['priya@lawlink.com', 'rahul@lawlink.com'];

const cleanup = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find test accounts to delete (any @lawlink.com or @test.com except the 2 we keep)
  const testUsers = await User.find({
    $or: [
      { email: { $regex: /@lawlink\.com$/i } },
      { email: { $regex: /@test\.com$/i } }
    ],
    email: { $nin: KEEP_EMAILS }
  });

  if (testUsers.length === 0) {
    console.log('No extra test accounts found. Nothing to delete.');
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log(`\nFound ${testUsers.length} test account(s) to remove:`);
  testUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.role}]`));

  for (const user of testUsers) {
    const userId = user._id;
    console.log(`\nDeleting ${user.name} (${user.email})...`);

    // Find cases to get their IDs for deadline deletion
    const cases = await Case.find({ $or: [{ lawyer: userId }, { client: userId }] });
    const caseIds = cases.map(c => c._id);

    if (caseIds.length > 0) {
      const dr = await Deadline.deleteMany({ case: { $in: caseIds } });
      console.log(`  Deadlines: ${dr.deletedCount}`);
    }

    const cr = await Case.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Cases: ${cr.deletedCount}`);

    const conr = await Consultation.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Consultations: ${conr.deletedCount}`);

    const docr = await LegalDocument.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Documents: ${docr.deletedCount}`);

    const ir = await Invoice.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Invoices: ${ir.deletedCount}`);

    const convs = await Conversation.find({ participants: userId });
    const convIds = convs.map(c => c._id);
    if (convIds.length > 0) {
      const mr = await Message.deleteMany({ conversation: { $in: convIds } });
      console.log(`  Messages: ${mr.deletedCount}`);
    }
    const cvr = await Conversation.deleteMany({ participants: userId });
    console.log(`  Conversations: ${cvr.deletedCount}`);

    await User.findByIdAndDelete(userId);
    console.log(`  ✅ User deleted`);
  }

  console.log('\n✅ Cleanup complete!');
  console.log('Remaining test accounts: priya@lawlink.com (lawyer), rahul@lawlink.com (client)');
  await mongoose.connection.close();
  process.exit(0);
};

cleanup().catch(err => { console.error(err); process.exit(1); });
