// Email OTP is used only to confirm a password-reset action. Normal portal
// sign-in remains a password-only flow.
const { getAdminApp } = require('./_firebaseAdmin');
const { generateOtp, hashOtp, MAIL_FROM } = require('./_security');
const { resolvePasswordResetContext } = require('./_passwordResetOtp');

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function buildOtpEmailHtml(code) {
    return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 0; background-color: #ffffff; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden;">
  <div style="background-color: #0B1E36; padding: 28px 32px; text-align: center;">
    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">ZENQOR</span><span style="font-size: 20px; font-weight: 800; color: #14B8A6; letter-spacing: 0.5px;"> HRMS/CDTS</span>
  </div>
  <div style="padding: 36px 32px; text-align: center;">
    <h2 style="color: #0B1E36; font-size: 19px; margin: 0 0 12px;">Confirm Your Password Reset</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">Enter this code before choosing a new password. It expires in 5 minutes.</p>
    <div style="display: inline-block; background-color: #F8FAFC; border: 2px dashed #14B8A6; border-radius: 12px; padding: 16px 32px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0B1E36;">${code}</div>
    <p style="color: #94A3B8; font-size: 12px; line-height: 1.6; margin: 24px 0 0;">If you did not request a password reset, you can ignore this email and your account will remain secure.</p>
  </div>
  <div style="background-color: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
    <p style="color: #94A3B8; font-size: 11px; margin: 0;">© ZENQOR HRMS/CDTS · Zenqor Technologies</p>
  </div>
</div>`;
}

async function sendOtpEmail(email, code) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set.');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: MAIL_FROM,
            to: [email],
            subject: 'Confirm Your ZENQOR Password Reset',
            html: buildOtpEmailHtml(code)
        })
    });
    if (!response.ok) throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        if (req.body?.purpose !== 'password-reset') {
            res.status(400).json({ error: 'Verification codes are available only for password resets.' });
            return;
        }

        const admin = getAdminApp();
        const reset = await resolvePasswordResetContext(admin, req.body);
        const now = Date.now();
        const otpRef = admin.firestore().collection('password_reset_otp_codes').doc(reset.fingerprint);
        const existing = await otpRef.get();
        if (existing.exists && now - new Date(existing.data().createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
            res.status(429).json({ error: 'Please wait before requesting another verification code.' });
            return;
        }

        const code = generateOtp();
        await otpRef.set({
            codeHash: hashOtp(code),
            email: reset.email,
            resetSource: reset.source,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
            used: false,
            attempts: 0
        });
        await sendOtpEmail(reset.email, code);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('request-login-otp error:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to send verification code right now. Please try again.' });
    }
};
