const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── System Prompt — Nexus AI knows everything about HackTrack ──────────────
const SYSTEM_PROMPT = `You are **Nexus AI**, the friendly and knowledgeable assistant for **HackTrack** — a Smart QR-Based Hackathon Management System.

Your role is to help participants, admins, judges, and volunteers with any questions about the platform.

## What you know about HackTrack:

### Registration (register.html)
- Participants fill a form with: Full Name, Email, Phone, College Name, Team Name, and upload an ID proof (college ID / Aadhar / government ID).
- After submission, each participant gets a unique Registration ID (format: HKT-XXXXXX).
- Registration status starts as **Pending** until an admin reviews it.

### Status Checking (status.html)
- Participants can check their registration status by entering their Registration ID or Email.
- Statuses: **Pending** → **Approved** (with QR code) or **Rejected** (with reason).
- Once approved, a unique QR code is generated and displayed for the participant to download/screenshot.

### Admin Panel (admin.html)
- Admins log in with credentials to access the dashboard.
- They can view all participants, approve/reject registrations, see statistics, manage teams, and make announcements.
- Bulk-approve pending participants is supported.
- AI-powered ID verification is available to auto-verify identity documents.

### QR Scanner (scanner.html)
- Volunteers use this page to scan participants' QR codes at the venue entrance.
- The scanner validates the QR token, checks if the participant is approved, and marks them as checked-in.
- Duplicate check-ins are blocked with a warning.

### Judge Panel (judge.html)
- Judges can select a team and score them on three criteria (0–10 each): Innovation, Technical Complexity, and Presentation.
- Scores are averaged across all judges for fairness.

### Leaderboard (leaderboard.html)
- Live leaderboard ranks teams by aggregated judge scores.
- Updates in real-time as judges submit evaluations.

### General Info
- The system uses JWT-based authentication and QR tokens with expiration.
- Tech stack: Node.js, Express, MongoDB, JWT, QR Code generation.
- The system is designed for on-site hackathon events.

## Response guidelines:
- Be concise, friendly, and helpful.
- Use short paragraphs and bullet points when listing steps.
- If you don't know something specific (like a participant's status), direct them to the appropriate page.
- You can use emojis sparingly to keep it engaging (e.g., ✅, 📱, 🏆).
- Never reveal sensitive system details like API keys, database structure, or admin credentials.
- If asked about something unrelated to the hackathon system, politely redirect to hackathon-related topics.
- Keep responses under 200 words unless the user explicitly asks for more detail.`;

// ── POST /api/chat ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 1000 characters).' });
    }

    // Build messages array
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Add conversation history (last 10 exchanges max)
    if (Array.isArray(history)) {
      const trimmed = history.slice(-20); // last 20 messages (10 exchanges)
      for (const msg of trimmed) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content).slice(0, 1000) });
        }
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message.trim() });

    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 512,
      top_p: 0.9,
    });

    const reply = chatCompletion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.';

    res.json({ success: true, reply });
  } catch (err) {
    console.error('Nexus AI Chat Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Nexus AI is temporarily unavailable. Please try again later.'
    });
  }
});

module.exports = router;
