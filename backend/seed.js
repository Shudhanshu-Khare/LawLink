// backend/seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');


dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');
const Case = require('./models/Case.model');
const Consultation = require('./models/Consultation.model');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding');

  // Clear existing data
  await User.deleteMany({});
  await Case.deleteMany({});
  await Consultation.deleteMany({});

  // Use plaintext — the User model's pre('save') hook handles bcrypt hashing
  const plainPassword = 'password123';

  // Create test lawyer
  const lawyer = await User.create({
    name: 'Priya Sharma', email: 'priya@lawlink.com', password: plainPassword,
    role: 'lawyer', isVerified: true, phone: '+919876543210',
    barRegistrationNumber: 'BAR-DL-2018-001', practiceAreas: ['criminal', 'civil'],
    courtAdmissions: ['Delhi High Court', 'Supreme Court'], feePerHour: 2500,
    yearsOfExperience: 8, languages: ['English', 'Hindi'],
    location: { city: 'Delhi', state: 'Delhi', country: 'India' },
    bio: 'Senior criminal lawyer with expertise in white-collar crime.'
  });

  // Create test client
  const client = await User.create({
    name: 'Rahul Kumar', email: 'rahul@lawlink.com', password: plainPassword,
    role: 'client', isVerified: true, phone: '+919876543220',
    legalMatterTypes: ['criminal', 'property'], location: { city: 'Delhi', state: 'Delhi' },
    bio: 'Looking for legal representation in a property dispute.'
  });

  // Create sample case
  await Case.create({
    client: client._id, lawyer: lawyer._id,
    title: 'Property Dispute — Sector 42', description: 'Boundary dispute with neighboring property.',
    legalArea: 'property', status: 'investigation',
    milestones: [
      { stage: 'intake', note: 'Case opened — initial documents collected', addedBy: lawyer._id },
      { stage: 'investigation', note: 'Survey report requested from municipal office', addedBy: lawyer._id }
    ]
  });

  console.log('\nSeed data created successfully!');
  console.log('========================================');
  console.log('Login credentials (all use password: password123):');
  console.log('  Lawyer:  priya@lawlink.com');
  console.log('  Client:  rahul@lawlink.com');
  console.log('========================================');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
