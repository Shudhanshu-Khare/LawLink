const request = require('supertest');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });
dns.setServers(['8.8.8.8', '8.8.4.4']);
jest.setTimeout(30000);

// Force OTP emails to use the dev console fallback during tests.
process.env.EMAIL_USER = '';
process.env.EMAIL_PASS = '';

const express = require('express');
const app = express();

app.use(express.json());
app.use(require('helmet')());
app.use(require('express-mongo-sanitize')());

const authRoutes = require('../routes/auth.routes');
app.use('/api/auth', authRoutes);

let token;
let otp;
const testUser = {
  name: 'Test Client',
  email: `test_${Date.now()}@lawlink.com`,
  password: 'password123',
  role: 'client'
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    const User = require('../models/User.model');
    await User.deleteOne({ email: testUser.email });
  }
  await mongoose.connection.close();
});

describe('Auth API', () => {
  test('POST /api/auth/register - should send an OTP for a new user', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation((message) => {
      const match = String(message).match(/(\d{6})$/);
      if (match) otp = match[1];
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    logSpy.mockRestore();

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresOTP).toBe(true);
    expect(otp).toBeDefined();
  });

  test('POST /api/auth/verify-otp - should create a new user', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: testUser.email, otp });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  test('POST /api/auth/register - should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login - should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('client');
  });

  test('POST /api/auth/login - should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me - should return user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email);
  });

  test('GET /api/auth/me - should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/auth/login - should reject NoSQL injection', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: testUser.password });

    expect(res.statusCode).not.toBe(200);
  });

  test('POST /api/auth/register - should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.statusCode).toBe(400);
  });
});
