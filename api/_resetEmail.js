function buildResetEmailHtml(resetLink) {
    return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 0; background-color: #ffffff; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden;">
  <div style="background-color: #0B1E36; padding: 28px 32px; text-align: center;">
    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">ZENQOR</span><span style="font-size: 20px; font-weight: 800; color: #14B8A6; letter-spacing: 0.5px;"> HRMS/CDTS</span>
  </div>
  <div style="padding: 36px 32px;">
    <h2 style="color: #0B1E36; font-size: 19px; margin: 0 0 20px; text-align: center;">Password Reset Request</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 8px;">Hello,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 28px;">We received a request to reset the password for your ZENQOR HRMS/CDTS account.</p>
    <div style="text-align: center; margin: 0 0 28px;">
      <a href="${resetLink}" style="display: inline-block; background-color: #14B8A6; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; padding: 15px 40px; border-radius: 10px;">RESET PASSWORD</a>
    </div>
    <p style="color: #94A3B8; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">This link expires in 30 minutes and can only be used once.<br>If you didn't request this, you can safely ignore this email.</p>
  </div>
  <div style="background-color: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
    <p style="color: #94A3B8; font-size: 11px; margin: 0;">© ZENQOR HRMS/CDTS · Zenqor Technologies</p>
  </div>
</div>`;
}

async function sendResetEmail(toEmail, resetLink) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set.');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'Zenqor Support <support@zenqor.com.my>',
            to: [toEmail],
            subject: 'Password Reset Request – ZENQOR HRMS/CDTS',
            html: buildResetEmailHtml(resetLink)
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Resend send failed: ${response.status} ${errText}`);
    }
}

module.exports = { sendResetEmail };
