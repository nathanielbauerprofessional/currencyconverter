const speakeasy = require("speakeasy");
const QRCode = require('qrcode');
const { checkUsernameFound } = require("./database");

function generateSecretKey() {
    return speakeasy.generateSecret({
        length: 20
      });
}

async function generateQRCode(secret) {
    return QRCode.toDataURL(secret.otpauth_url); 
  }

async function verify2FA(secret, token) {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token,
      });
    } catch (error) {
      console.error("Error verifying 2FA:", error.message);
      return false;
    }
  }

  
  module.exports = { generateSecretKey, generateQRCode, verify2FA };

