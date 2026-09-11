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

// Create a pre-existing user for login tests
let loginTestUser;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const User = require('../models/User.model');
  loginTestUser = await User.create({
    name: 'Login Test User',
    email: `login_test_${Date.now()}@lawlink.com`,
    password: 'password123',
    role: 'client',
    authMethod: 'password'
  });
  token = loginTestUser.getSignedJwtToken();
}, 30000);

afterAll(async () => {
  const User = require('../models/User.model');
  if (loginTestUser?._id) await User.deleteOne({ _id: loginTestUser._id });
  await mongoose.connection.close();
}, 30000);

describe('Auth API', () => {
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
      .send({ email: { "$gt": "" }, password: 'password123' });

    expect(res.statusCode).not.toBe(200);
  });
});
