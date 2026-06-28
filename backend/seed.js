const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');
const Case = require('./models/Case.model');
const Consultation = require('./models/Consultation.model');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding');

  await User.deleteMany({});
  await Case.deleteMany({});
  await Consultation.deleteMany({});

  const hashedPassword = await bcrypt.hash('password123', 12);

  const lawyers = await User.create([
    {
      name: 'Adv. Priya Sharma', email: 'priya@lawlink.com', password: hashedPassword,
      role: 'lawyer', phone: '+919876543210',
      barRegistrationNumber: 'BAR-DL-2018-001', practiceAreas: ['criminal', 'civil'],
      courtAdmissions: ['Delhi High Court', 'Supreme Court'], feePerHour: 2500,
      yearsOfExperience: 8, languages: ['English', 'Hindi'],
      location: { city: 'Delhi', state: 'Delhi', country: 'India' },
      bio: 'Senior criminal lawyer with expertise in white-collar crime.'
    },
    {
      name: 'Adv. Rahul Mehta', email: 'rahul@lawlink.com', password: hashedPassword,
      role: 'lawyer', phone: '+919876543211',
      barRegistrationNumber: 'BAR-MH-2015-042', practiceAreas: ['corporate', 'property'],
      courtAdmissions: ['Bombay High Court'], feePerHour: 3500,
      yearsOfExperience: 11, languages: ['English', 'Hindi', 'Marathi'],
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      bio: 'Corporate law specialist handling mergers and acquisitions.'
    },
    {
      name: 'Adv. Anjali Desai', email: 'anjali@lawlink.com', password: hashedPassword,
      role: 'lawyer', phone: '+919876543212',
      barRegistrationNumber: 'BAR-KA-2019-088', practiceAreas: ['family', 'civil'],
      courtAdmissions: ['Karnataka High Court'], feePerHour: 2000,
      yearsOfExperience: 5, languages: ['English', 'Kannada'],
      location: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
      bio: 'Family law and divorce mediation expert.'
    }
  ]);

  const clients = await User.create([
    {
      name: 'Vikram Singh', email: 'vikram@test.com', password: hashedPassword,
      role: 'client', phone: '+919876543220',
      legalMatterTypes: ['criminal'], location: { city: 'Delhi', state: 'Delhi' },
      bio: 'Looking for legal representation in a property dispute.'
    },
    {
      name: 'Neha Gupta', email: 'neha@test.com', password: hashedPassword,
      role: 'client', phone: '+919876543221',
      legalMatterTypes: ['family', 'property'], location: { city: 'Mumbai', state: 'Maharashtra' },
      bio: 'Seeking guidance on family court proceedings.'
    }
  ]);

  await Case.create({
    client: clients[0]._id, lawyer: lawyers[0]._id,
    title: 'Property Dispute — Sector 42', description: 'Boundary dispute with neighboring property.',
    legalArea: 'property', status: 'investigation',
    milestones: [
      { stage: 'intake', note: 'Case opened — initial documents collected', addedBy: lawyers[0]._id },
      { stage: 'investigation', note: 'Survey report requested from municipal office', addedBy: lawyers[0]._id }
    ]
  });

  console.log('\nSeed data created successfully!');
  console.log('========================================');
  console.log('Login credentials (all use password: password123):');
  console.log('  Lawyers:');
  console.log('    priya@lawlink.com');
  console.log('    rahul@lawlink.com');
  console.log('    anjali@lawlink.com');
  console.log('  Clients:');
  console.log('    vikram@test.com');
  console.log('    neha@test.com');
  console.log('========================================');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
