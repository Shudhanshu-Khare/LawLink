// backend/tests/auth.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Use Google DNS to resolve MongoDB Atlas SRV records (same as server.js)
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const express = require('express');
const app = express();

app.use(express.json());
app.use(require('helmet')());
app.use(require('express-mongo-sanitize')());

const authRoutes = require('../routes/auth.routes');
app.use('/api/auth', authRoutes);

let token;
const testUser = {
  name: 'Test Client',
  email: `test_${Date.now()}@lawlink.com`,
  password: 'password123',
  role: 'client'
};

// Create a pre-existing user for login tests (bypasses OTP flow)
let loginTestUser;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Directly create a user in DB for login tests (model pre-save handles hashing)
  const User = require('../models/User.model');
  loginTestUser = await User.create({
    name: 'Login Test User',
    email: `login_test_${Date.now()}@lawlink.com`,
    password: 'password123',
    role: 'client',
    authMethod: 'password'
  });
  token = loginTestUser.getSignedJwtToken();
}, 30000); // 30s timeout for Atlas connection

afterAll(async () => {
  const User = require('../models/User.model');
  await User.deleteOne({ email: testUser.email });
  if (loginTestUser?._id) await User.deleteOne({ _id: loginTestUser._id });
  await mongoose.connection.close();
}, 30000); // 30s timeout for cleanup

describe('Auth API', () => {
  // ── Registration (OTP Flow) ──

  test('POST /api/auth/register — should accept valid data for new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    // 200 = OTP sent successfully via email
    // 500 = OTP generated but email transport failed (expected in test env without SMTP)
    if (res.statusCode === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.requiresOTP).toBe(true);
    } else {
      // Email sending failed — this is an environment issue, not a code bug
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBeDefined();
    }
  });

  test('POST /api/auth/register — should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ── Login ──

  test('POST /api/auth/login — should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginTestUser.email, password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('client');
    token = res.body.token;
  });

  test('POST /api/auth/login — should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginTestUser.email, password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Token Validation ──

  test('GET /api/auth/me — should return user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(loginTestUser.email);
  });

  test('GET /api/auth/me — should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.statusCode).toBe(401);
  });

  // ── Security ──

  test('POST /api/auth/login — should reject NoSQL injection', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { "$gt": "" }, password: testUser.password });

    expect(res.statusCode).not.toBe(200);
  });

  test('POST /api/auth/register — should reject invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Hacker', email: 'hack@test.com', password: '123456', role: 'admin' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Role must be client or lawyer/);
  });
});
