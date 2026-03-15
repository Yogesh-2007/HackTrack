# ⚡ HackTrack — Smart QR-Based Hackathon Management System

A complete full-stack web application for managing hackathons with QR-based entry,
digital judging, and live leaderboards.

---

## 🏗️ Project Structure

```
hackathon-system/
├── backend/
│   ├── models/
│   │   ├── Participant.js       # Participant schema (registration + QR + checkin)
│   │   ├── Admin.js             # Admin/volunteer accounts
│   │   ├── Judge.js             # Judge accounts
│   │   ├── Score.js             # Evaluation scores
│   │   └── EntryLog.js          # QR scan audit log
│   ├── routes/
│   │   ├── auth.js              # POST /api/auth/admin/login, /judge/login
│   │   ├── participants.js      # POST /api/participants/register, GET /status/:email
│   │   ├── admin.js             # Admin CRUD + approve/reject + stats
│   │   ├── qr.js                # POST /api/qr/scan
│   │   ├── judges.js            # GET /teams, POST /score
│   │   └── leaderboard.js       # GET /api/leaderboard
│   ├── middleware/
│   │   ├── auth.js              # JWT verification middleware
│   │   └── upload.js            # Multer file upload config
│   ├── utils/
│   │   ├── qrUtils.js           # QR generation & validation (JWT)
│   │   └── seedAdmin.js         # First-run admin account seeder
│   ├── uploads/                 # ID proof file storage
│   ├── server.js                # Express app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    └── public/
        ├── index.html           # Landing page
        ├── register.html        # Participant registration
        ├── status.html          # Check status + view QR
        ├── admin.html           # Admin dashboard + management
        ├── scanner.html         # QR scanner for volunteers
        ├── judge.html           # Judge evaluation panel
        ├── leaderboard.html     # Live rankings
        ├── css/
        │   └── style.css        # Full design system
        └── js/
            └── utils.js         # Shared API client + helpers
```

---

## 🛠️ Tech Stack

| Layer        | Technology                             |
|--------------|----------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JavaScript        |
| Backend      | Node.js 18+, Express.js 4.x            |
| Database     | MongoDB (local or Atlas)               |
| Auth         | JSON Web Tokens (JWT)                  |
| QR Codes     | `qrcode` npm package                   |
| File Upload  | `multer`                               |
| Validation   | `express-validator`                    |
| Security     | `bcryptjs`, `express-rate-limit`       |
| QR Scanning  | `jsQR` (browser library via CDN)       |

---

## 📡 REST API Reference

| Method | Endpoint                          | Auth     | Description                                  |
|--------|-----------------------------------|----------|----------------------------------------------|
| POST   | `/api/auth/admin/login`           | Public   | Admin login → returns JWT                    |
| POST   | `/api/auth/judge/login`           | Public   | Judge login → returns JWT                    |
| POST   | `/api/auth/judge/create`          | Admin    | Create a judge account                       |
| GET    | `/api/auth/me`                    | Token    | Get current logged-in user info              |
| POST   | `/api/participants/register`      | Public   | Register participant + upload ID proof       |
| GET    | `/api/participants/status/:email` | Public   | Check registration status + get QR code      |
| GET    | `/api/admin/participants`         | Admin    | List all participants (filter by status)     |
| POST   | `/api/admin/approve/:id`          | Admin    | Approve participant + auto-generate QR       |
| POST   | `/api/admin/reject/:id`           | Admin    | Reject participant with reason               |
| POST   | `/api/admin/bulk-approve`         | Admin    | Approve ALL pending participants at once     |
| GET    | `/api/admin/stats`                | Admin    | Live dashboard statistics                    |
| GET    | `/api/admin/entry-logs`           | Admin    | View all QR scan audit logs                  |
| POST   | `/api/admin/regenerate-qr/:id`    | Admin    | Regenerate QR code for a participant         |
| POST   | `/api/qr/scan`                    | Public   | Validate QR token + check in participant     |
| GET    | `/api/qr/verify/:token`           | Public   | Verify a QR token without checking in        |
| GET    | `/api/judges/teams`               | Judge    | List all checked-in teams for scoring        |
| POST   | `/api/judges/score`               | Judge    | Submit evaluation scores for a team          |
| PUT    | `/api/judges/score/:participantId`| Judge    | Update a previously submitted score          |
| GET    | `/api/judges/my-scores`           | Judge    | View all scores submitted by this judge      |
| GET    | `/api/judges/list`                | Admin    | List all registered judges                   |
| GET    | `/api/leaderboard`                | Public   | Get full ranked leaderboard with avg scores  |

---

## 🗃️ MongoDB Schemas Overview

### Participant
```
registrationId, name, email, phone, college, teamName, projectTitle,
idProof { filename, path, mimetype }, status (pending/approved/rejected),
rejectionReason, approvedBy, approvedAt,
qrCode { image, token, generatedAt, expiresAt },
checkedIn, checkedInAt, checkedInBy
```

### Admin
```
name, email, password (hashed), role (superadmin/admin/volunteer),
isActive, lastLogin
```

### Judge
```
name, email, password (hashed), expertise, assignedTeams[], isActive
```

### Score
```
participant (ref), judge (ref), teamName, projectTitle,
innovation (0-10), technicalComplexity (0-10), presentation (0-10),
feasibility (0-10, optional), impact (0-10, optional),
totalScore (auto-calculated), feedback, submittedAt
```

### EntryLog
```
participant (ref), registrationId, participantName,
action (checkin/checkout/duplicate_scan/invalid_qr/expired_qr),
success, scannedBy, ipAddress, userAgent, message, timestamp
```

---

## ⚙️ Complete Workflow

```
1. REGISTRATION
   Participant → fills form (name/email/phone/college/team/ID proof)
   → POST /api/participants/register
   → Stored in MongoDB with status = "pending"

2. ADMIN VERIFICATION
   Admin logs in → views pending list
   → Reviews ID proof image
   → POST /api/admin/approve/:id
   → Backend generates JWT-signed QR code (24h expiry)
   → QR image stored as base64 in MongoDB

3. QR DELIVERY
   Participant → GET /api/participants/status/:email
   → Sees QR code on status page
   → Can download/print QR

4. VENUE ENTRY
   Volunteer → opens scanner.html
   → Camera scans QR code (jsQR library decodes)
   → POST /api/qr/scan { token }
   → Backend: verify JWT → check participant → mark checkedIn
   → Duplicate scan = blocked + logged
   → EntryLog record created

5. JUDGING
   Judge logs in → sees all checked-in teams
   → Scores Innovation, Technical, Presentation (0-10 sliders)
   → POST /api/judges/score
   → Score stored with judge reference

6. LEADERBOARD
   GET /api/leaderboard
   → Aggregates avg scores per team across all judges
   → Sorted by totalScore descending
   → Auto-refreshes every 30 seconds
```

---

## 🔐 Security Features

- **JWT Auth** — Admin and judge routes require valid Bearer tokens
- **Separate QR Secret** — QR tokens use a dedicated `QR_JWT_SECRET`
- **Token Expiry** — QR codes expire (default 24h), checked on every scan
- **bcrypt** — All passwords hashed with salt rounds = 12
- **Duplicate Scan Prevention** — DB flag + entry log blocks re-entry
- **Rate Limiting** — Global: 200 req/15min; Auth: 20/15min; Scan: 60/min
- **Input Validation** — express-validator on all public endpoints
- **File Type Check** — Multer only accepts JPG, PNG, PDF for ID proofs

---

## 🚀 Step-by-Step Setup Guide

### Prerequisites

Make sure you have installed:
- **Node.js** v18 or higher → https://nodejs.org
- **MongoDB** (local) → https://www.mongodb.com/try/download/community
  OR use **MongoDB Atlas** (free cloud) → https://cloud.mongodb.com

---

### Step 1 — Clone / Extract the Project

```bash
cd hackathon-system
```

---

### Step 2 — Install Backend Dependencies

```bash
cd backend
npm install
```

This installs: express, mongoose, jsonwebtoken, qrcode, multer,
bcryptjs, cors, express-validator, express-rate-limit, dotenv, uuid, nodemailer

---

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/hackathon_db
JWT_SECRET=change_this_to_a_long_random_string_32chars_min
QR_JWT_SECRET=another_long_random_string_for_qr_tokens
QR_EXPIRES_IN=24h
ADMIN_EMAIL=admin@hackathon.com
ADMIN_PASSWORD=Admin@123456
FRONTEND_URL=http://localhost:5000
```

> **For MongoDB Atlas**: Replace MONGO_URI with your Atlas connection string.
> `MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/hackathon_db`

---

### Step 4 — Start MongoDB (if local)

**Windows:**
```cmd
net start MongoDB
```

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

---

### Step 5 — Start the Server

```bash
# From the backend/ directory
npm start

# OR for development with auto-restart:
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
✅ Default admin created: admin@hackathon.com
🚀 Hackathon Server running on http://localhost:5000
```

---

### Step 6 — Access the Application

Open your browser and visit:

| Page            | URL                                |
|-----------------|------------------------------------|
| 🏠 Home         | http://localhost:5000              |
| 📋 Register     | http://localhost:5000/register.html|
| 🔍 My Status    | http://localhost:5000/status.html  |
| 🛡️ Admin Panel  | http://localhost:5000/admin.html   |
| 📷 QR Scanner   | http://localhost:5000/scanner.html |
| ⚖️ Judge Panel  | http://localhost:5000/judge.html   |
| 🏆 Leaderboard  | http://localhost:5000/leaderboard.html |

---

### Step 7 — First Login

**Admin Login:**
- Email: `admin@hackathon.com`
- Password: `Admin@123456`

> ⚠️ Change the password after first login!

---

### Step 8 — Testing the Full Workflow

1. **Register a participant** at `/register.html`
   - Fill all fields, upload any image as ID proof
   - Note the Registration ID shown after submission

2. **Approve in Admin panel** at `/admin.html`
   - Login with admin credentials
   - Go to "Pending" tab, click Approve
   - A QR code is auto-generated

3. **Check participant status** at `/status.html`
   - Enter the registered email
   - View and download the QR code

4. **Scan the QR** at `/scanner.html`
   - Click "Start Camera" (or paste the JWT token manually)
   - Participant is marked as checked in

5. **Create a judge** in Admin → Judges tab
   - Fill judge name/email/password

6. **Submit scores** at `/judge.html`
   - Login as the judge
   - Select a team, move sliders, submit

7. **View rankings** at `/leaderboard.html`
   - Auto-updates every 30 seconds

---

## 🧪 Quick API Test with curl

```bash
# Register participant
curl -X POST http://localhost:5000/api/participants/register \
  -F "name=Arjun Sharma" \
  -F "email=arjun@example.com" \
  -F "phone=9876543210" \
  -F "college=IIT Mumbai" \
  -F "teamName=CodeCrafters"

# Admin login
curl -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hackathon.com","password":"Admin@123456"}'

# Get all participants (replace TOKEN)
curl http://localhost:5000/api/admin/participants \
  -H "Authorization: Bearer TOKEN"

# View leaderboard
curl http://localhost:5000/api/leaderboard
```

---

## 🎯 Bonus Features Implemented

- ✅ **Expiring QR Codes** — JWT with configurable expiry (default 24h)
- ✅ **Rate Limiting** — express-rate-limit on all routes
- ✅ **Admin Analytics** — Live stats dashboard with recent check-ins
- ✅ **Bulk Approve** — Approve all pending participants at once
- ✅ **Duplicate Scan Prevention** — DB flag + detailed entry log
- ✅ **QR Regeneration** — Admin can regenerate expired QR codes
- ✅ **Drag-and-Drop Upload** — ID proof upload with drag & drop
- ✅ **Score Update** — Judges can revise their scores
- ✅ **Audio Feedback** — Scanner plays beep sounds on scan
- ✅ **Flash Support** — Toggle camera flash in scanner
- ✅ **Manual Token Entry** — Paste JWT token if no camera available
- ✅ **Podium Display** — Top 3 highlighted on leaderboard

---

## 📦 npm Packages Used

```
express          - Web framework
mongoose         - MongoDB ODM
jsonwebtoken     - JWT generation & verification
qrcode           - QR code image generation
multer           - Multipart form / file upload
bcryptjs         - Password hashing
cors             - Cross-origin resource sharing
express-validator- Input validation & sanitization
express-rate-limit- Rate limiting middleware
dotenv           - Environment variable loader
uuid             - Unique ID generation
nodemailer       - Email sending (optional)
nodemon (dev)    - Auto-restart on file change
```

---

## ⚡ Common Issues & Fixes

| Issue                      | Fix                                               |
|----------------------------|---------------------------------------------------|
| MongoDB connection refused | Start MongoDB service (see Step 4)               |
| Camera not working         | Use HTTPS or localhost; grant browser permission  |
| Login fails                | Check .env ADMIN_EMAIL/PASSWORD match             |
| QR expired                 | Use admin panel to regenerate QR for participant  |
| Port already in use        | Change PORT in .env or kill process on 5000       |
| File upload fails          | Check uploads/ folder exists and is writable      |
