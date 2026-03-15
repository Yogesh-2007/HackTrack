const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

/**
 * Generate a secure QR code for an approved participant.
 * The QR embeds a signed JWT with participantID + expiry.
 */
const generateParticipantQR = async (participant) => {
  const expiresIn = process.env.QR_EXPIRES_IN || '24h';

  // Build the QR payload
  const payload = {
    participantId: participant._id.toString(),
    registrationId: participant.registrationId,
    name: participant.name,
    email: participant.email,
    type: 'hackathon_entry',
    iat: Math.floor(Date.now() / 1000)
  };

  // Sign with QR-specific secret
  const token = jwt.sign(payload, process.env.QR_JWT_SECRET || 'qr_secret', { expiresIn });

  // Decode to get actual expiry timestamp
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  // Generate QR image (base64 data URL)
  const qrDataURL = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.95,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff'
    },
    width: 400
  });

  return {
    image: qrDataURL,
    token,
    generatedAt: new Date(),
    expiresAt
  };
};

/**
 * Validate a QR token from a scan.
 * Returns decoded payload or throws an error.
 */
const validateQRToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.QR_JWT_SECRET || 'qr_secret');
    if (decoded.type !== 'hackathon_entry') {
      throw new Error('Invalid QR code type');
    }
    return { valid: true, payload: decoded };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, reason: 'expired', message: 'QR code has expired.' };
    }
    if (err.name === 'JsonWebTokenError') {
      return { valid: false, reason: 'invalid', message: 'Invalid QR code.' };
    }
    return { valid: false, reason: 'error', message: err.message };
  }
};

module.exports = { generateParticipantQR, validateQRToken };
