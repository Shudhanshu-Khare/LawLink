# LawLink

LawLink is a full-stack legal workflow platform for clients and lawyers. Clients can find lawyers, book consultations, chat, track case progress, download legal documents and pay invoices. Lawyers can manage consultations, open cases, update milestones, issue PDFs, create invoices and track court deadlines.

I built this as a resume project to show more than a basic CRUD app: it has real-time messaging, role-based workflows, PDF generation, scheduled reminders, authentication, and a MongoDB-backed data model that connects several real product flows together.

## What You Can Try

After running the project locally, a good demo path is:

1. Log in as a client and browse the lawyer directory.
2. Book a consultation from an available slot.
3. Log in as a lawyer and confirm the consultation.
4. Create or open a case and move it through the case timeline.
5. Start a chat between the client and lawyer.
6. Generate a legal document or invoice PDF.
7. Add a court deadline and see it appear in the deadline calendar.

## Core Features

| Area | What it does |
| Authentication | Email/password registration with OTP verification, plus Google OAuth sign-in with strict account-method separation. |
| Lawyer Directory | Search and filter lawyers by practice area, city and profile details. |
| Consultation Booking | Clients book 60-minute slots; booked and past slots are blocked. |
| Case Timeline | Lawyers move cases through a 6-stage lifecycle: intake, investigation, filing, hearing, resolution and closed. |
| Real-time Chat | Socket.io messaging with online status, typing indicators, delivered/read states and unread count. |
| Legal Documents | Lawyers issue legal documents and the backend generates downloadable PDFs. |
| Invoices | Lawyers create billable line-item invoices with generated PDFs and client payment status. |
| Deadlines | Lawyers add court dates and filing deadlines; the backend has a daily reminder job. |
| Profiles | Lawyers can update professional details such as bar number, practice areas, experience and fees. |

## Why This Project Is Interesting

LawLink is intentionally built around connected workflows instead of isolated screens. A consultation can lead into a case. A case can have milestones, documents, invoices and deadlines. Chat sits beside those flows so the client and lawyer can communicate in real time.

Some technical pieces worth noticing:

- JWT authentication with role-based route access.
- Socket.io server and client for real-time chat behavior.
- Mongoose schemas with relationships between users, cases, invoices, documents and deadlines.
- pdfkit pipelines for legal documents and invoices.
- node-cron reminder service for upcoming deadlines.
- Jest and Supertest API tests for the auth flow.
- Basic hardening with Helmet, rate limiting and Mongo query sanitization.

## Tech Stack

| Layer | Tools |
| Frontend | React, Vite, React Router, Bootstrap, Framer Motion, Axios, Socket.io Client |
| Backend | Node.js, Express, Socket.io, Mongoose, JWT, bcryptjs |
| Database | MongoDB Atlas |
| Auth | Email OTP, Google OAuth |
| Documents | pdfkit |
| Background jobs | node-cron |
| Email | Nodemailer |
| Tests | Jest, Supertest |

## Architecture

```text
React + Vite
   |
   | REST API + Socket.io client
   v
Express + Socket.io
   |
   | Mongoose
   v
MongoDB Atlas

Express also runs:
- Nodemailer for OTPs and deadline reminders
- pdfkit for document and invoice PDFs
- node-cron for scheduled deadline checks
```

## Getting Started

Clone the repo and install dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/lawlink.git
cd lawlink
npm run install-all
```

Create the backend environment file:

```bash
cp backend/config/config.env.example backend/config/config.env
```

Fill in the required values:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password
```

For local development, email credentials are optional. If `EMAIL_USER` and `EMAIL_PASS` are missing, OTPs are printed in the backend terminal instead of being sent.

Start both apps:

```bash
npm run dev
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:5000
```

## Useful Scripts

From the project root:

```bash
npm run dev          # frontend + backend together
npm run build        # production frontend build
npm run install-all  # install root, backend and frontend dependencies
```

From `backend`:

```bash
npm run dev    # backend with nodemon
npm run seed   # seed demo users and sample data
npm test       # run API tests
```

From `src`:

```bash
npm run dev      # frontend only
npm run build    # frontend production build
npm run preview  # preview production build
```

## Tests

```bash
cd backend
npm test
```

The current test suite covers the email OTP auth flow, login, token validation, duplicate email handling, invalid credentials and NoSQL injection rejection.

## Project Structure

```text
lawlink/
  backend/
    controllers/     Express route handlers
    models/          Mongoose schemas
    routes/          API route definitions
    middleware/      Auth and upload middleware
    services/        Email, PDF and reminder services
    socket/          Socket.io event handlers
    tests/           Jest/Supertest tests
    utils/           Shared helpers
  src/
    src/
      components/    Shared React components
      contexts/      Auth context
      hooks/         Socket hook
      pages/         Application screens
      services/      Axios API helpers
    public/          Static assets
```

## API Overview

| Area | Base route |
| Auth | `/api/auth` |
| Users | `/api/users` |
| Consultations | `/api/consultations` |
| Cases | `/api/cases` |
| Chat | `/api/chat` |
| Documents | `/api/documents` |
| Invoices | `/api/invoices` |
| Deadlines | `/api/deadlines` |

## Notes

- The app is currently configured for local development.
- MongoDB Atlas is remote, so some local API calls can depend on network latency.
- Uploaded/generated files are stored under `backend/uploads`, which is ignored by Git.
- Secrets should stay in `backend/config/config.env` and should not be committed.