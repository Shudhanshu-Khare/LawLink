# LawLink

A production-ready, full-stack legal workflow platform that connects clients with lawyers through real-time communication, case management, consultation scheduling, document generation, invoicing, and deadline tracking.

Built with React 18, Node.js, Express, MongoDB, and Socket.io. Deployed on Render and Vercel.

**Live**: [lawlink.vercel.app](https://lawlink.vercel.app)

---

## Features

### Client Features
- Browse a searchable lawyer directory with filters for practice area, experience, and fee range
- Book consultations from a 14-day rolling calendar with real-time slot availability
- Track case progress through a visual 6-stage milestone timeline
- Download legal documents and invoices as auto-generated PDFs
- Real-time chat with assigned lawyers, including typing indicators and read receipts

### Lawyer Features
- Manage client cases across six lifecycle stages: Intake, Investigation, Filing, Hearing, Resolution, Closed
- Create legal documents and invoices with automatic PDF generation via pdfkit
- Set court deadlines with automated email reminders 48 hours before the due date
- View client online status and communicate instantly through real-time chat

### Admin Features
- Platform-wide dashboard with user statistics (verified, pending, blocked)
- Verify, block, or delete user accounts with role-based action controls
- Separate tables for lawyers, clients, and pending approval requests

---

## Architecture

```
                           FRONTEND                              BACKEND                           DATABASE
                    ┌─────────────────────┐             ┌─────────────────────┐            ┌──────────────────┐
                    │     React 18        │   REST API  │   Express + Node    │  Mongoose  │  MongoDB Atlas   │
                    │     Vite            │ ◄─────────► │   Socket.io Server  │ ◄────────► │  8 Collections   │
                    │     Vercel          │             │   Render            │            │  Indexed Queries │
                    └────────┬────────────┘             └──────────┬──────────┘            └──────────────────┘
                             │                                     │
                             │  WebSocket (Socket.io)              │  Services
                             │  - Real-time messaging              │  - Nodemailer (OTP, reminders, password reset)
                             │  - Typing indicators                │  - pdfkit (document and invoice PDFs)
                             │  - Online presence                  │  - node-cron (daily deadline check at 08:00)
                             │  - Read receipts                    │  - Google OAuth 2.0 (server-side verification)
                             │                                     │
                             └─────────────────────────────────────┘
```

### Request Flow

```
Client Browser
     │
     ▼
Vercel CDN (static assets)
     │
     ▼ API requests (Axios + httpOnly cookies)
     │
Render Proxy (rate limiting at edge)
     │
     ▼
Express Server
     ├── Helmet (security headers)
     ├── CORS (origin validation)
     ├── express-mongo-sanitize (input cleaning)
     ├── express-rate-limit (1000 req / 15 min)
     ├── JWT Auth Middleware (cookie extraction + verification)
     ├── Role Authorization (client / lawyer / admin)
     └── Controller → Mongoose → MongoDB Atlas
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Framer Motion, Bootstrap Icons, Axios, Socket.io Client |
| **Backend** | Node.js, Express, Socket.io, Mongoose, jsonwebtoken, bcryptjs, pdfkit, node-cron, Nodemailer |
| **Database** | MongoDB Atlas (User, Case, Consultation, Conversation, Message, LegalDocument, Invoice, Deadline) |
| **Authentication** | Google OAuth 2.0 (server-side), JWT in httpOnly cookies, bcrypt password hashing |
| **Security** | Helmet, express-rate-limit, express-mongo-sanitize, express-validator, cookie-parser |
| **Testing** | Jest, Supertest |
| **Deployment** | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## Security Implementation

| Layer | Implementation |
|---|---|
| **Token Storage** | JWT stored in httpOnly + secure + sameSite cookies; inaccessible to client-side JavaScript |
| **Password Handling** | bcrypt with salt rounds; password field excluded from all API responses via `select: false` |
| **Route Protection** | Every API route behind JWT verification middleware with role-based access control |
| **Input Sanitization** | express-mongo-sanitize strips `$` and `.` operators to prevent NoSQL injection |
| **Rate Limiting** | 1000 requests per 15-minute window per IP in production; Socket.io and health checks exempted |
| **HTTP Headers** | Helmet applies 11+ security headers including HSTS, X-Frame-Options, Content-Security-Policy |
| **WebSocket Auth** | Socket.io connections authenticated via JWT on handshake; unauthenticated connections rejected |
| **Session Management** | Auto-logout after 20 minutes of inactivity; activity tracked via click, scroll, keypress, and mouse events |
| **OAuth Verification** | Google tokens verified server-side using `google-auth-library`; no client-side token trust |
| **Error Handling** | Global error middleware; uncaughtException and unhandledRejection handlers prevent server crashes |

---

## Session and Server Management

### Keepalive Strategy
The frontend sends a health check ping to the backend every 4 minutes, but only while a user is actively logged in. On logout, the keepalive stops. This ensures the server remains awake during active usage without wasting resources when the platform is idle.

### Cold Start Handling
The backend runs on Render's free tier, which spins down after 15 minutes of no inbound traffic. When a returning user triggers a cold start and the server takes longer than 4 seconds to respond, a full-screen "Starting server..." overlay is displayed. The user does not see a blank page or broken state.

### Auto-Retry on Network Failures
API requests that fail due to timeouts, 502 errors, or network interruptions are automatically retried up to 3 times with exponential backoff (3s, 6s, 9s delays). This handles cold start latency transparently.

### Activity-Based Session Expiry
User interactions (clicks, scrolling, typing, mouse movement, touch events) update an activity timestamp in localStorage. A background check runs every 5 minutes: if no activity has been recorded for 20 minutes, the session is terminated and the user is redirected to the login page. This also applies on tab close and reopen.

---

## Project Structure

```
LawLink/
├── backend/
│   ├── controllers/          # 9 route handlers (auth, admin, case, chat, consultation,
│   │                         #   deadline, document, invoice, user)
│   ├── models/               # 8 Mongoose schemas with indexes
│   │   ├── User.model.js
│   │   ├── Case.model.js
│   │   ├── Consultation.model.js
│   │   ├── Conversation.model.js
│   │   ├── Message.model.js
│   │   ├── LegalDocument.model.js
│   │   ├── Invoice.model.js
│   │   └── Deadline.model.js
│   ├── routes/               # Express route definitions with middleware
│   ├── middleware/            # JWT authentication and file upload
│   ├── validators/           # express-validator rule sets
│   ├── services/             # Deadline reminder cron service
│   ├── socket/               # Socket.io connection and event handlers
│   ├── tests/                # Jest + Supertest API tests
│   ├── seed.js               # Test data seeder
│   ├── migrate-verify.js     # Database migration utility
│   ├── cleanup-test-accounts.js  # Test account cleanup script
│   └── server.js             # Application entry point
│
├── src/
│   └── src/
│       ├── pages/            # 12 application screens
│       │   ├── Login.jsx             # Dual auth (Google OAuth + email/password)
│       │   ├── Register.jsx          # Role-based registration (client/lawyer)
│       │   ├── Chat.jsx              # Real-time messaging with Socket.io
│       │   ├── CaseManager.jsx       # Case CRUD + milestone timeline
│       │   ├── ConsultationHub.jsx   # Consultation list and status management
│       │   ├── BookConsultation.jsx  # Calendar-based slot booking
│       │   ├── DocumentHub.jsx       # Legal document management + PDF download
│       │   ├── InvoiceManager.jsx    # Invoice creation + PDF generation
│       │   ├── DeadlineCalendar.jsx  # Court deadline tracking
│       │   ├── LawyerDirectory.jsx   # Searchable lawyer listings
│       │   ├── Profile.jsx           # User profile management
│       │   └── AdminDashboard.jsx    # Admin controls and statistics
│       ├── components/       # Sidebar navigation, CaseTimeline visualization
│       ├── contexts/         # AuthContext (session management), SocketContext (real-time)
│       ├── hooks/            # useSocket custom hook
│       ├── services/         # Axios API layer with retry logic and keepalive
│       └── styles/           # Design system (lawlink.css with CSS custom properties)
│
└── README.md
```

---

## API Reference

All endpoints are prefixed with `/api/`.

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register with email and password | Public |
| POST | `/auth/login` | Login with email and password | Public |
| POST | `/auth/google` | Google OAuth sign-in | Public |
| POST | `/auth/google-register` | Google OAuth sign-up with role selection | Public |
| GET | `/auth/me` | Get current user profile | JWT |
| PUT | `/auth/profile` | Update profile details | JWT |
| POST | `/auth/logout` | Clear auth cookie | JWT |
| POST | `/auth/forgot-password` | Send password reset email | Public |
| PUT | `/auth/reset-password/:token` | Reset password with token | Public |

### Admin
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/admin/stats` | Platform-wide statistics | Admin |
| GET | `/admin/lawyers` | All registered lawyers | Admin |
| GET | `/admin/clients` | All registered clients | Admin |
| POST | `/admin/verify/:id` | Verify a pending user | Admin |
| POST | `/admin/block/:id` | Block/unblock a user | Admin |
| DELETE | `/admin/:id` | Delete a user account | Admin |

### Cases
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/cases/` | Create a new case | Lawyer |
| GET | `/cases/` | Get user's cases | JWT |
| PUT | `/cases/:id/status` | Update case stage | Lawyer |
| POST | `/cases/:id/milestone` | Add milestone entry | Lawyer |

### Consultations
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/consultations/` | Book a consultation | Client |
| GET | `/consultations/` | Get user's consultations | JWT |
| PUT | `/consultations/:id/status` | Accept/reject/complete | Lawyer |
| GET | `/consultations/availability/:lawyerId` | Check lawyer availability | JWT |

### Chat
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/chat/conversations` | Get user's conversations | JWT |
| GET | `/chat/messages/:id` | Get messages in conversation | JWT |
| GET | `/chat/unread-count` | Total unread messages | JWT |

### Documents, Invoices, Deadlines
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/documents/` | Create legal document | Lawyer |
| GET | `/documents/` | Get user's documents | JWT |
| GET | `/documents/:id/pdf` | Download document PDF | JWT |
| POST | `/invoices/` | Create invoice with line items | Lawyer |
| GET | `/invoices/:id/pdf` | Download invoice PDF | JWT |
| PUT | `/invoices/:id/pay` | Mark invoice as paid | Client |
| POST | `/deadlines/` | Create court deadline | Lawyer |
| GET | `/deadlines/` | Get user's deadlines | JWT |
| DELETE | `/deadlines/:id` | Remove a deadline | Lawyer |

---

## Responsive Design

The platform is fully responsive across desktop and mobile devices:

- Login and Register pages adapt to phone screens with scrollable card-based forms
- Chat switches from a two-column layout (conversation list + chat area) to single-column with a back button on mobile
- Dashboard, Documents, Invoices, and Consultations cards stack vertically on small screens
- Case Timeline is horizontally scrollable on phones
- Admin tables are wrapped in scroll containers for overflow handling
- All interactive elements maintain a minimum 44px touch target

All mobile styles are contained within `@media` queries. Desktop layout is not affected.

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Google Cloud Console project (for OAuth)
- Gmail account with App Password (for email services)

### Installation

```bash
# Clone the repository
git clone https://github.com/Shudhanshu-Khare/LawLink.git
cd LawLink

# Install all dependencies
npm run install-all

# Configure environment
cp .env.example backend/config/config.env
# Edit config.env with your credentials (see Environment Variables below)

# Seed test data (optional)
cd backend && npm run seed && cd ..

# Start development servers
npm run dev
```

Frontend: `http://localhost:5173` | Backend: `http://localhost:5000`

### Test Accounts

After running the seed script:

| Role | Email | Password |
|---|---|---|
| Lawyer | priya@lawlink.com | password123 |
| Client | rahul@lawlink.com | password123 |

---

## Environment Variables

Create `backend/config/config.env` using `.env.example` as a template:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing (use a long random string) |
| `JWT_EXPIRE` | Token expiry duration (e.g., `30d`) |
| `EMAIL_USER` | Gmail address for OTPs and deadline reminders |
| `EMAIL_PASS` | Gmail App Password (16-character) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |

---

## Tests

```bash
cd backend && npm test
```

8 API tests covering user registration, authentication, token validation, duplicate account prevention, and NoSQL injection resistance.

---

## Future Scope

- End-to-end encryption for chat messages
- Video consultations via WebRTC
- Payment gateway integration (Razorpay / Stripe)
- Push notifications
- Multi-language support
- Role-based analytics dashboard

---

## License

MIT
