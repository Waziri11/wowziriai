import nodemailer from "nodemailer";

let transporter;

export function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== "false"; // default true for 465
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.APP_EMAIL_FROM || user;

  if (!user || !pass) {
    throw new Error("SMTP credentials are missing");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  transporter.fromAddress = from;
  return transporter;
}

export async function sendOtpEmail({ to, code }) {
  const appName = "Wowziri";
  const text = `Your ${appName} verification code is ${code}. It expires in 5 minutes.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                ${appName}
              </h1>
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 400;">
                Travel. Explore. Discover.
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 48px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Verify Your Email
              </h2>
              <p style="margin: 0 0 32px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Thanks for signing up! Please use the verification code below to complete your registration and start your journey with us.
              </p>
              
              <!-- OTP Code Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 32px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #f6f8fc 0%, #eef2f7 100%); border: 2px solid #e1e8ed; border-radius: 12px; padding: 32px 24px;">
                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                      Your Verification Code
                    </p>
                    <p style="margin: 0; color: #667eea; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Expiration Notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fff9e6; border-left: 4px solid #ffc107; border-radius: 8px; padding: 16px 20px; margin: 0 0 32px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                      ⏱️ <strong>This code expires in 5 minutes.</strong> Please enter it soon to verify your account.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px 0; color: #666666; font-size: 15px; line-height: 1.6;">
                If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">
                      🔒 Security Notice
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                      ${appName} will never ask you to share your verification code with anyone. Keep it confidential.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 24px; border-top: 1px solid #e5e7eb; margin-top: 24px;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                      © 2026 ${appName}. All rights reserved.<br>
                      This is an automated message, please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  console.log(`[Email] Sending OTP to ${to}: ${code}`);
  const transport = getTransporter();
  await transport.sendMail({
    from: transport.fromAddress || process.env.APP_EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${appName} verification code`,
    text,
    html,
  });
  console.log(`[Email] OTP email sent successfully to ${to}`);
}
