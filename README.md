# ⚖️ LawLink

**A full-stack legal workspace** where clients connect with lawyers — from booking consultations and tracking cases to real-time chat, document generation, invoicing, and court deadline reminders.

Built from scratch with React, Node.js, MongoDB, and Socket.io. Deployed live on Render + Vercel.

🔗 **Live Demo**: [lawlink.vercel.app](https://lawlink.vercel.app)

---

## Why I built this

Most legal workflows still run on emails, spreadsheets, and WhatsApp groups. I wanted to build something that puts the entire client-lawyer relationship — consultations, cases, documents, payments, and communication — into one clean platform. No context switching, no lost files, no missed deadlines.

---

## What it does

### For Clients
- Browse a directory of verified lawyers (filterable by practice area, experience, and fee range)
- Book consultation slots from a 14-day rolling calendar
- Track case progress through a visual 6-stage timeline
- Download legal documents and invoices as PDFs
- Chat with their lawyer in real time

### For Lawyers
- Manage cases with milestone tracking (Intake → Investigation → Filing → Hearing → Resolution → Closed)
- Generate legal documents and invoices with auto-built PDFs
- Set court deadlines that trigger email reminders 48 hours before due date
- See which clients are online and respond instantly via chat

### For Admins
- Verify, block, or remove user accounts
- View platform-wide stats (total lawyers, clients, pending approvals)
- Role-based tables with quick action buttons

---

## Architecture

```
┌──────────────┐          ┌──────────────────┐          ┌───────────────┐
│   Frontend   │◄────────►│   Backend API    │◄────────►│  MongoDB Atlas│
│  React 18    │  REST    │  Express + Node  │ Mongoose │  (Cloud DB)   │
│  (Vercel)    │  + WS    │  (Render)        │          │               │
└──────┬───────┘          └────────┬─────────┘          └───────────────┘
       │                           │
       │ Socket.io                 ├── Nodemailer (OTP, password reset, reminders)
       │ (real-time chat,          ├── pdfkit (document & invoice PDFs)
       │  typing indicators,       ├── node-cron (daily deadline check at 8 AM)
       │  online presence)         └── Google OAuth 2.0 (sign-in/sign-up)
       │                           
       └──────────────────────────►│
```

---

## Tech Stack

| Layer | What I used |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Framer Motion, Bootstrap Icons, Axios |
| **Backend** | Node.js, Express, Socket.io, Mongoose, JWT, bcryptjs, pdfkit, node-cron |
| **Database** | MongoDB Atlas (8 models, indexed for performance) |
| **Auth** | Google OAuth 2.0, JWT in httpOnly cookies, bcrypt password hashing |
| **Security** | Helmet, express-rate-limit, express-mongo-sanitize, express-validator |
| **Deployment** | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## Security

Not just "it has login." Here's what's actually implemented:

| What | How |
|---|---|
| **Tokens** | JWT stored in httpOnly + secure + sameSite cookies — JavaScript can't touch them |
| **Passwords** | bcrypt with salt rounds, never stored in plain text |
| **API protection** | Every route behind JWT middleware, role-checked (client/lawyer/admin) |
| **Input sanitization** | express-mongo-sanitize blocks NoSQL injection (`$gt`, `$ne` attacks) |
| **Rate limiting** | 1000 requests per 15 minutes per IP in production |
| **Headers** | Helmet sets 11+ security headers (HSTS, X-Frame-Options, CSP, etc.) |
| **Socket auth** | WebSocket connections verified with JWT on handshake — no anonymous sockets |
| **Session expiry** | Auto-logout after 20 minutes of inactivity (tracks clicks, scroll, keypress) |
| **Google OAuth** | Server-side token verification via `google-auth-library` — no client-side trust |

---

## Session & Server Management

A few things I'm proud of in this project:

**Smart keepalive** — The frontend pings the backend health endpoint every 4 minutes, but *only while a user is logged in*. When everyone logs out, the pings stop and the server is free to sleep. No wasted resources.

**Cold start handling** — Since this runs on Render's free tier, the server sleeps after 15 minutes of no traffic. When a user visits and the server is waking up, a "Starting server..." overlay appears after 4 seconds so they know what's happening instead of staring at a blank screen.

**Activity-based sessions** — The app tracks user interactions (clicks, scrolling, typing, mouse movement, touch). If there's no activity for 20 minutes, the session expires and the user is redirected to login. This works both when the tab is open (checked every 5 minutes) and when the user closes and reopens the tab.

**Auto-retry** — API requests that fail due to cold starts (timeouts, 502s, network errors) automatically retry up to 3 times with increasing delays (3s → 6s → 9s). The user doesn't have to manually refresh.

---

## Project Structure

```
LawLink/
├── backend/
│   ├── controllers/          # Route handlers (auth, chat, case, etc.)
│   ├── models/               # Mongoose schemas (User, Case, Message, etc.)
│   ├── routes/               # Express route definitions
│   ├── middleware/            # JWT auth middleware
│   ├── validators/           # Input validation rules
│   ├── services/             # Reminder cron job
│   ├── socket/               # Socket.io event handlers
│   ├── tests/                # Jest + Supertest API tests
│   ├── seed.js               # Test data seeder
│   └── server.js             # App entry point
│
├── src/
│   └── src/
│       ├── pages/            # 12 application screens
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Chat.jsx
│       │   ├── CaseManager.jsx
│       │   ├── ConsultationHub.jsx
│       │   ├── BookConsultation.jsx
│       │   ├── DocumentHub.jsx
│       │   ├── InvoiceManager.jsx
│       │   ├── DeadlineCalendar.jsx
│       │   ├── LawyerDirectory.jsx
│       │   ├── Profile.jsx
│       │   └── AdminDashboard.jsx
│       ├── components/       # Sidebar, CaseTimeline
│       ├── contexts/         # AuthContext, SocketContext
│       ├── hooks/            # useSocket
│       ├── services/         # API layer with retry + keepalive
│       └── styles/           # Design system (lawlink.css)
│
└── README.md
```

---

## API Overview

| Module | Key Endpoints | Auth |
|---|---|---|
| **Auth** | `/register`, `/login`, `/google`, `/me`, `/logout`, `/forgot-password`, `/reset-password/:token` | Public / JWT |
| **Admin** | `/stats`, `/lawyers`, `/clients`, `/verify/:id`, `/block/:id`, `DELETE /:id` | Admin only |
| **Users** | `GET /lawyers`, `GET /:id` | Public |
| **Consultations** | `POST /`, `GET /`, `PUT /:id/status`, `GET /availability/:lawyerId` | JWT + Role |
| **Cases** | `POST /`, `GET /`, `PUT /:id/status`, `POST /:id/milestone` | JWT + Role |
| **Chat** | `GET /conversations`, `GET /messages/:id`, `GET /unread-count` | JWT |
| **Documents** | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/revoke` | JWT + Role |
| **Invoices** | `POST /`, `GET /`, `GET /:id/pdf`, `PUT /:id/pay` | JWT + Role |
| **Deadlines** | `POST /`, `GET /`, `DELETE /:id` | JWT + Role |

All endpoints prefixed with `/api/`. Role-based access means certain actions are restricted — e.g., only lawyers can create documents, only clients can mark invoices as paid.

---

## Getting Started

```bash
# Clone
git clone https://github.com/Shudhanshu-Khare/LawLink.git
cd LawLink

# Install everything
npm run install-all

# Set up environment variables
cp .env.example backend/config/config.env
# Fill in: MONGO_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASS, GOOGLE_CLIENT_ID

# Seed test data (optional)
cd backend && npm run seed

# Run both servers
cd .. && npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:5000`

### Test Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Lawyer | priya@lawlink.com | password123 |
| Client | rahul@lawlink.com | password123 |

---

## Environment Variables

| Variable | What it's for |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (use something long and random) |
| `JWT_EXPIRE` | Token lifetime (e.g., `30d`) |
| `EMAIL_USER` | Gmail address for sending OTPs and deadline reminders |
| `EMAIL_PASS` | Gmail App Password (16-character, not your regular password) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console for OAuth |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `CLIENT_URL` | Frontend URL for CORS (`http://localhost:5173` locally) |

---

## Responsive Design

The entire platform works on both desktop and mobile:

- **Login/Register** — card-based layout that adapts to phone screens with scrollable forms
- **Chat** — switches from 2-column (list + conversation) to single-column with a back button on mobile
- **Dashboard, Documents, Invoices, Consultations** — cards stack vertically on small screens
- **Case Timeline** — horizontally scrollable on phones
- **Admin tables** — wrapped in scroll containers
- **Touch targets** — all buttons and inputs are at least 44px for comfortable tapping

Desktop layout is completely untouched by mobile styles — everything is inside `@media` queries.

---

## Tests

```bash
cd backend && npm test
```

8 API tests covering registration, login, token validation, duplicate handling, and NoSQL injection prevention.

---

## What I'd add next

If I were to keep building:
- End-to-end encryption for chat messages
- Video consultations (WebRTC)
- Payment gateway integration (Razorpay/Stripe)
- Push notifications for mobile
- Multi-language support

---

## License

MIT — use it however you want.
