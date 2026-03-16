const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

// Use a single consistent secret getter so generation & validation always match
const getQRSecret = () => process.env.QR_JWT_SECRET || 'qr_fallback_secret_hacktrack';

/**
 * Generate a secure QR code for an approved participant.
 * FIX: Use pure black (#000000) — coloured QR codes fail to scan with jsQR/phone cameras.
 * FIX: Use errorCorrectionLevel 'M' — 'H' produces a denser QR that is harder to decode.
 * FIX: Slim payload — fewer characters = less dense QR = much faster/reliable scanning.
 */
const generateParticipantQR = async (participant) => {
  const expiresIn = process.env.QR_EXPIRES_IN || '24h';

  // SLIM payload — only essentials (shorter JWT = simpler QR = easier scan)
  const payload = {
    pid: participant._id.toString(),
    rid: participant.registrationId,
    t:   'hkt'                        // type flag, shorter than 'hackathon_entry'
  };

  const token = jwt.sign(payload, getQRSecret(), { expiresIn });

  const decoded  = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  // CRITICAL: pure black on white — any other colour breaks camera/jsQR scanning
  const qrDataURL = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 3,
    color: {
      dark:  '#000000',
      light: '#ffffff'
    },
    width: 300
  });

  return { image: qrDataURL, token, generatedAt: new Date(), expiresAt };
};

/**
 * Validate a scanned QR token.
 * Handles both old tokens (type:'hackathon_entry') and new slim tokens (t:'hkt').
 */
const validateQRToken = (token) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'invalid', message: 'No token provided.' };
  }

  // Strip whitespace/newlines that can creep in from copy-paste
  token = token.trim();

  try {
    const decoded = jwt.verify(token, getQRSecret());

    // Accept both old format and new slim format
    const isValidType = decoded.t === 'hkt' || decoded.type === 'hackathon_entry';
    if (!isValidType) {
      return { valid: false, reason: 'invalid', message: 'Invalid QR code type.' };
    }

    // Normalise field names: old uses participantId, new uses pid
    const participantId = decoded.pid || decoded.participantId;
    if (!participantId) {
      return { valid: false, reason: 'invalid', message: 'QR missing participant data.' };
    }

    return {
      valid: true,
      payload: { ...decoded, participantId }
    };

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, reason: 'expired', message: 'QR code has expired. Ask admin to regenerate it.' };
    }
    if (err.name === 'JsonWebTokenError') {
      return { valid: false, reason: 'invalid', message: 'Invalid or corrupted QR code.' };
    }
    return { valid: false, reason: 'error', message: err.message };
  }
};

module.exports = { generateParticipantQR, validateQRToken };
