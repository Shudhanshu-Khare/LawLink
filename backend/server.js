// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const dns = require('dns');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// Fix DNS for MongoDB Atlas SRV lookups (use Google DNS)
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Load env vars
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

// Prevent server from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err.message || err);
});

// Log when Render terminates the process (helps diagnose shutdowns)
process.on('SIGTERM', () => {
  console.log('>>> SIGTERM received — Render is shutting down this instance');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('>>> SIGINT received — process interrupted');
  process.exit(0);
});

const app = express();
const server = http.createServer(app);

// ── Socket.io Setup ──
const { Server } = require('socket.io');
const setupSocket = require('./socket/handlers');

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const socketState = setupSocket(io);

// Make io accessible to controllers
app.set('io', io);
app.set('socketState', socketState);

const isProduction = process.env.NODE_ENV === 'production';

// Trust ALL proxies in the chain (Render may have multiple proxy layers)
app.set('trust proxy', true);

// ── CORS must run BEFORE rate limiter so 429 responses include CORS headers ──
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// ── Security Middleware ──
app.use(require('helmet')());                     // Set secure HTTP headers
app.use(require('express-mongo-sanitize')());      // Prevent NoSQL injection
app.use(require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: isProduction ? 1000 : 2000,  // High limit — Render proxy makes all users share one IP
  message: { success: false, message: 'Too many requests, please try again later' },
  skip: (req) => req.path.startsWith('/socket.io') || req.path === '/api/health',
  validate: false  // Suppress express-rate-limit v7 trust proxy validation error on Render
}));

// ── Core Middleware ──
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- ROUTE IMPORTS (add these as we build each feature) ---
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const consultationRoutes = require('./routes/consultation.routes');
const caseRoutes = require('./routes/case.routes');
const chatRoutes = require('./routes/chat.routes');
const documentRoutes = require('./routes/document.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const deadlineRoutes = require('./routes/deadline.routes');
const adminRoutes = require('./routes/admin.routes');

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    // Initialize cron services
    const { initReminderService } = require('./services/reminderService');
    initReminderService(io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // Self-ping keepalive: prevent Render from thinking we're idle
      // Pings our own health endpoint every 4 minutes
      if (isProduction) {
        setInterval(() => {
          const url = `http://localhost:${PORT}/api/health`;
          http.get(url, () => {}).on('error', () => {});
        }, 4 * 60 * 1000);
        console.log('Keepalive ping enabled (every 4 minutes)');
      }
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Auto-reconnect MongoDB if connection drops
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting reconnect...');
  setTimeout(() => {
    mongoose.connect(process.env.MONGO_URI).catch(() => {});
  }, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

// Export server for Socket.io setup later
module.exports = { app, server };
