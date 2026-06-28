# LawLink — Legal Services Platform

A full-stack, real-time legal workflow platform connecting clients and lawyers. Built with React 18, Node.js, MongoDB, and Socket.io.

---

## Authentication

LawLink supports **two sign-in methods** — strictly separated per account:

| Method | How it works |
|--------|-------------|
| **Google Sign-In** | One-click OAuth 2.0 — no password needed |
| **Email + Password** | OTP email verification via Nodemailer |

> An account registered with Google can only sign in with Google.  
> An account registered with email+password can only sign in with email+password.

---

## Architecture

```
React 18 (Vite)  ←→  Express API  ←→  MongoDB Atlas
       ↕                  ↕
  Socket.io Client  ←→  Socket.io Server
                          ↕
                    node-cron (Daily Jobs)
                    Nodemailer (OTP + Reminders)
                    pdfkit (PDF Generation)
                    Google OAuth 2.0
```

---

## Key Features

| Feature | Description |
|---|---|
| **Google OAuth + OTP Auth** | Dual authentication — Google sign-in or email+OTP verification with strict method separation |
| **Case Timeline Tracker** | 6-stage lifecycle (Intake → Closed) with animated milestone timeline and real-time Socket.io updates |
| **Real-time Chat** | WhatsApp-style messaging with sent/read receipts, typing indicators, and unread notification dot |
| **Consultation Booking** | 14-day calendar with 9 hourly slots (9AM-6PM), real-time availability, past-slot filtering |
| **Legal Document Hub** | Lawyers create legal documents → PDF auto-generated via pdfkit → clients download |
| **Invoice System** | Billable hours tracking with line items → PDF invoice generation → payment flow |
| **Deadline Calendar** | Court deadline management with node-cron daily reminders + 48hr urgency alerts |
| **Lawyer Directory** | Searchable directory with practice areas, experience, fee info, and live "slots available today" |
| **Profile Management** | Lawyers can update professional details (bar number, fee, practice areas) from profile page |
| **Security** | Helmet, rate limiting, NoSQL injection prevention, JWT + bcrypt RBAC |

---

## Tech Stack

**Frontend**: React 18, React Router v6, Framer Motion, Bootstrap 5, Axios, Socket.io Client, @react-oauth/google  
**Backend**: Node.js, Express, Socket.io, Mongoose, JWT, bcrypt, Multer, pdfkit, node-cron, Nodemailer, google-auth-library  
**Security**: Helmet, express-rate-limit, express-mongo-sanitize  
**Database**: MongoDB (Atlas)  
**Testing**: Jest, Supertest  

---

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/lawlink.git
cd lawlink

# Install all dependencies
npm run install-all

# Set up environment
cp backend/config/config.env.example backend/config/config.env
# Edit config.env with your MongoDB URI, JWT secret, Gmail credentials, and Google Client ID

# Run both frontend + backend
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:5000`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRE` | Token expiry (e.g., `30d`) |
| `EMAIL_USER` | Gmail address for sending OTPs |
| `EMAIL_PASS` | Gmail App Password (16-char) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `CLIENT_URL` | Frontend URL for CORS |

---

## Tests

```bash
cd backend
npm test
```

8 Jest API tests covering auth registration, login, token validation, duplicate rejection, and NoSQL injection prevention.

---

## Project Structure

```
lawlink/
├── src/                    # React frontend (Vite)
│   ├── components/         # Navbar, DeadlineBadge
│   ├── pages/              # Route pages (11 pages)
│   ├── contexts/           # AuthContext
│   ├── hooks/              # useSocket
│   └── services/           # Axios API layer
├── backend/
│   ├── controllers/        # Route handlers (8 controllers)
│   ├── models/             # 8 Mongoose schemas
│   ├── routes/             # Express route files
│   ├── middleware/          # Auth + upload middleware
│   ├── services/           # PDF, email, cron services
│   ├── socket/             # Socket.io event handlers
│   ├── tests/              # Jest API tests
│   └── utils/              # Pagination helper
└── docs/                   # Build guides (9 steps)
```

---

## API Endpoints

| Group | Endpoints | Auth |
|---|---|---|
| Auth | `POST /register`, `POST /verify-otp`, `POST /login`, `POST /google`, `POST /google-register`, `GET /me`, `PUT /profile` | Public/JWT |
| Users | `GET /lawyers`, `GET /:id` | Public |
| Consultations | `POST /`, `GET /`, `PUT /:id/status`, `GET /availability/:lawyerId` | JWT + RBAC |
| Cases | `POST /`, `GET /`, `PUT /:id/status`, `POST /:id/milestone` | JWT + RBAC |
| Chat | `GET /conversations`, `GET /messages/:id`, `GET /unread-count` | JWT |
| Documents | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/revoke` | JWT + RBAC |
| Invoices | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/pay` | JWT + RBAC |
| Deadlines | `POST /`, `GET /`, `DELETE /:id` | JWT + RBAC |

---

## License

MIT
