const Groq = require('groq-sdk');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

// ── Configuration ──────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const AUTO_APPROVE_THRESHOLD = parseInt(process.env.ID_VERIFY_AUTO_APPROVE_THRESHOLD) || 75;
const AUTO_REJECT_THRESHOLD  = parseInt(process.env.ID_VERIFY_AUTO_REJECT_THRESHOLD)  || 50;

let groqClient = null;

function getGroqClient() {
  if (!groqClient && GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groqClient;
}

// ── OCR: Extract text from ID proof image ──────────────────────────────────────
async function extractTextFromImage(filePath) {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, '..', filePath);

    if (!fs.existsSync(absolutePath)) {
      return { success: false, text: '', error: 'File not found' };
    }

    const ext = path.extname(absolutePath).toLowerCase();
    if (ext === '.pdf') {
      return { success: false, text: '', error: 'PDF files cannot be OCR-processed. Manual review required.' };
    }

    console.log(`🔍 OCR: Processing ${path.basename(absolutePath)}...`);
    const { data } = await Tesseract.recognize(absolutePath, 'eng', {
      logger: () => {} // silent
    });

    const text = data.text?.trim() || '';
    console.log(`✅ OCR: Extracted ${text.length} characters`);

    return { success: text.length > 0, text, confidence: data.confidence || 0 };
  } catch (err) {
    console.error('❌ OCR Error:', err.message);
    return { success: false, text: '', error: err.message };
  }
}

// ── AI: Verify identity by comparing registration data with OCR text ───────────
async function verifyWithAI(registrationData, extractedText) {
  const client = getGroqClient();
  if (!client) {
    return {
      score: 0,
      status: 'manual_review',
      reasoning: 'AI verification unavailable — GROQ_API_KEY not configured. Manual admin review required.',
      extractedFields: {}
    };
  }

  const prompt = `You are an identity verification agent for a hackathon registration system.

TASK: Compare the text extracted from an uploaded ID proof document against the registration data provided by the participant. Determine if the ID proof is legitimate and matches the registered person.

REGISTRATION DATA:
- Name: ${registrationData.name}
- Email: ${registrationData.email}
- Phone: ${registrationData.phone || 'Not provided'}
- College/Institution: ${registrationData.college || 'Not provided'}

TEXT EXTRACTED FROM ID PROOF (via OCR):
"""
${extractedText || 'No text could be extracted from the document'}
"""

INSTRUCTIONS:
1. Check if the name on the ID matches or closely resembles the registered name (account for OCR errors, abbreviations, and name order variations)
2. Check if the institution/college on the ID matches the registered college
3. Look for any ID number, enrollment number, or other identifying information
4. Consider OCR quality — some characters may be misread
5. If the extracted text is empty or too short, the ID may be unclear or invalid

RESPOND IN THIS EXACT JSON FORMAT ONLY (no markdown, no extra text):
{
  "score": <number 0-100>,
  "status": "<verified|failed|manual_review>",
  "reasoning": "<2-3 sentence explanation of your decision>",
  "extractedFields": {
    "name": "<name found on ID or null>",
    "institution": "<institution found on ID or null>",
    "idNumber": "<ID/enrollment number found or null>"
  },
  "nameMatch": <true|false>,
  "institutionMatch": <true|false>
}

SCORING GUIDE:
- 80-100: Name clearly matches AND institution matches
- 60-79: Name matches but institution unclear/missing, OR close match with minor OCR discrepancies
- 40-59: Partial match — some info matches but significant uncertainty
- 0-39: No match or document appears invalid/unreadable`;

  try {
    console.log('🤖 AI: Sending verification request to Groq...');
    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(responseText);

    console.log(`✅ AI: Verification score = ${result.score}, status = ${result.status}`);

    return {
      score: Math.min(100, Math.max(0, Number(result.score) || 0)),
      status: result.status || 'manual_review',
      reasoning: result.reasoning || 'No reasoning provided',
      extractedFields: {
        name: result.extractedFields?.name || null,
        institution: result.extractedFields?.institution || null,
        idNumber: result.extractedFields?.idNumber || null
      },
      nameMatch: result.nameMatch || false,
      institutionMatch: result.institutionMatch || false
    };
  } catch (err) {
    console.error('❌ AI Verification Error:', err.message);
    return {
      score: 0,
      status: 'manual_review',
      reasoning: `AI verification failed: ${err.message}. Manual review required.`,
      extractedFields: {}
    };
  }
}

// ── Main verification function ─────────────────────────────────────────────────
async function verifyParticipantID(participant) {
  const result = {
    status: 'pending',
    score: 0,
    reasoning: '',
    extractedText: '',
    extractedFields: {},
    verifiedAt: null,
    method: 'ai_auto'
  };

  // No ID proof uploaded
  if (!participant.idProof?.path) {
    result.status = 'manual_review';
    result.reasoning = 'No ID proof document was uploaded. Manual admin verification required.';
    return result;
  }

  // Step 1: OCR
  const filePath = participant.idProof.path.startsWith('/uploads')
    ? path.join(__dirname, '..', participant.idProof.path)
    : participant.idProof.path;

  const ocrResult = await extractTextFromImage(filePath);

  if (!ocrResult.success) {
    result.status = 'manual_review';
    result.reasoning = `OCR failed: ${ocrResult.error}. Manual review required.`;
    result.extractedText = ocrResult.text || '';
    return result;
  }

  result.extractedText = ocrResult.text;

  // Step 2: AI Verification
  const aiResult = await verifyWithAI({
    name: participant.name,
    email: participant.email,
    phone: participant.phone,
    college: participant.college || participant.collegeName
  }, ocrResult.text);

  result.score = aiResult.score;
  result.reasoning = aiResult.reasoning;
  result.extractedFields = aiResult.extractedFields;
  result.verifiedAt = new Date();

  // Step 3: Determine status based on thresholds
  if (aiResult.score >= AUTO_APPROVE_THRESHOLD) {
    result.status = 'verified';
  } else if (aiResult.score >= AUTO_REJECT_THRESHOLD) {
    result.status = 'manual_review';
  } else {
    result.status = 'failed';
  }

  return result;
}

// ── Determine participant approval status from verification ────────────────────
function getApprovalAction(verificationResult) {
  if (verificationResult.status === 'verified') {
    return 'auto_approve';
  } else if (verificationResult.status === 'failed') {
    return 'auto_reject';
  }
  return 'manual_review'; // needs admin attention
}

module.exports = {
  extractTextFromImage,
  verifyWithAI,
  verifyParticipantID,
  getApprovalAction,
  AUTO_APPROVE_THRESHOLD,
  AUTO_REJECT_THRESHOLD
};
