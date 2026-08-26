# LawLink — Legal Services Platform

A production-ready, full-stack legal workflow platform that connects clients with lawyers through real-time communication, case tracking, consultation booking, document generation, invoicing, and deadline management — all secured with industry-standard authentication and privacy practices.

Built with React 18, Node.js, Express, MongoDB, and Socket.io.

---

## Features

### Authentication & Security
- **Dual sign-in** — Google OAuth 2.0 or email + OTP verification (strictly separated per account)
- **httpOnly cookie-based JWT** — tokens are never exposed to JavaScript, preventing XSS token theft
- **Password reset via email** — SHA-256 hashed tokens with 30-minute expiry
- **Input validation** — all API routes validated with express-validator
- **Security headers** — Helmet (11+ headers), NoSQL injection prevention, rate limiting, CORS
- **OTP brute-force protection** — max 5 attempts, auto-expiry via MongoDB TTL index
- **Admin verification gate** — new accounts require admin approval before accessing the platform

### Core Modules
- **Real-time Chat** — WhatsApp-style messaging with sent/read receipts (✓/✓✓), typing indicators, online status, and unread notification badges via Socket.io
- **Case Management** — 6-stage lifecycle (Intake → Investigation → Negotiation → Litigation → Resolution → Closed) with animated milestone timeline
- **Consultation Booking** — 14-day calendar with 9 hourly slots (9 AM–6 PM), real-time availability, and past-slot filtering
- **Legal Document Hub** — Lawyers create legal documents, auto-generate PDFs via pdfkit, clients download
- **Invoice System** — Billable hours tracking with line items, PDF invoice generation, and payment status flow
- **Deadline Calendar** — Court deadline management with daily email reminders via node-cron and 48-hour urgency alerts
- **Lawyer Directory** — Searchable and filterable by practice area, experience, fee range, and live "slots available today"
- **Admin Dashboard** — Real-time stats (verified, pending, blocked users), verify/block/delete actions, role-based tables
- **Profile Management** — Lawyers update professional details (bar number, fees, practice areas, bio)

---

## Architecture

```
React 18 (Vite)  ←→  Express REST API  ←→  MongoDB Atlas
       ↕                    ↕
 Socket.io Client  ←→  Socket.io Server
                          ↕
                    Nodemailer (OTP + Reminders + Password Reset)
                    pdfkit (PDF Generation)
                    node-cron (Daily Deadline Jobs)
                    Google OAuth 2.0
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Router v6, Framer Motion, Bootstrap 5, Axios, Socket.io Client, @react-oauth/google |
| **Backend** | Node.js, Express, Socket.io, Mongoose, JWT, bcrypt, Multer, pdfkit, node-cron, Nodemailer |
| **Security** | Helmet, express-rate-limit, express-mongo-sanitize, express-validator, cookie-parser, morgan |
| **Database** | MongoDB Atlas (12 performance indexes, TTL indexes for OTP auto-cleanup) |
| **Testing** | Jest, Supertest |

---

## Security Implementation

| Layer | What's Protected |
|-------|-----------------|
| **Authentication** | bcrypt (12 salt rounds), JWT in httpOnly/secure/sameSite cookies, Google OAuth server-side verification |
| **Input** | express-validator on all auth routes, Mongoose schema validation, express-mongo-sanitize |
| **Network** | Helmet headers, CORS with credentials, rate limiting (100 req/15 min production), request logging (morgan) |
| **Data** | Password field excluded from all API responses (`select: false`), OTP stored in MongoDB with TTL auto-expiry |
| **Session** | Logout clears httpOnly cookie server-side, Socket.io authenticated via JWT handshake |
| **Admin** | Role-based access control, admin can't self-block/delete, blocked users enforced on both login methods |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Shudhanshu-Khare/LawLink.git
cd LawLink

# Install all dependencies (root + backend + frontend)
npm run install-all

# Configure environment variables
cp .env.example backend/config/config.env
# Edit config.env with your MongoDB URI, JWT secret, Gmail credentials, and Google Client ID

# Start development servers (frontend + backend)
npm run dev
```

Frontend runs at `http://localhost:5173` · Backend at `http://localhost:5000`

---

## Environment Variables

Create `backend/config/config.env` using `.env.example` as a template:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing (use a long random string) |
| `JWT_EXPIRE` | Token expiry duration (e.g., `30d`) |
| `EMAIL_USER` | Gmail address for sending OTPs and reminders |
| `EMAIL_PASS` | Gmail App Password (16-character) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |

---

## Project Structure

```
lawlink/
├── backend/
│   ├── controllers/        # 9 route handlers (auth, admin, case, chat, etc.)
│   ├── models/             # 9 Mongoose schemas with indexes
│   ├── routes/             # Express route definitions
│   ├── middleware/         # JWT auth + file upload middleware
│   ├── validators/         # express-validator rules
│   ├── services/           # Email, PDF, and reminder services
│   ├── socket/             # Socket.io event handlers
│   ├── tests/              # Jest + Supertest API tests
│   ├── utils/              # Pagination helper
│   └── server.js           # Express app entry point
├── src/
│   └── src/
│       ├── pages/          # 14 application screens
│       ├── components/     # Navbar, DeadlineBadge
│       ├── contexts/       # Auth context (cookie-based)
│       ├── hooks/          # Socket.io hook
│       └── services/       # Axios API layer
└── .env.example            # Environment variable template
```

---

## API Endpoints

| Module | Endpoints | Auth |
|--------|-----------|------|
| **Auth** | `POST /register`, `POST /verify-otp`, `POST /resend-otp`, `POST /login`, `POST /google`, `POST /google-register`, `GET /me`, `PUT /profile`, `POST /logout`, `POST /forgot-password`, `PUT /reset-password/:token` | Public / JWT |
| **Admin** | `GET /stats`, `GET /lawyers`, `GET /clients`, `POST /verify/:id`, `POST /block/:id`, `DELETE /:id` | JWT + Admin |
| **Users** | `GET /lawyers`, `GET /:id` | Public |
| **Consultations** | `POST /`, `GET /`, `PUT /:id/status`, `GET /availability/:lawyerId` | JWT + RBAC |
| **Cases** | `POST /`, `GET /`, `PUT /:id/status`, `POST /:id/milestone` | JWT + RBAC |
| **Chat** | `GET /conversations`, `GET /messages/:id`, `GET /unread-count` | JWT |
| **Documents** | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/revoke` | JWT + RBAC |
| **Invoices** | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/pay` | JWT + RBAC |
| **Deadlines** | `POST /`, `GET /`, `DELETE /:id` | JWT + RBAC |

---

## Tests

```bash
cd backend && npm test
```

8 API tests covering registration, login, token validation, duplicate rejection, and NoSQL injection prevention.

---

## License

MIT
