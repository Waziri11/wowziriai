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

  // In development, allow missing SMTP creds and fall back to console logging.
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP credentials are missing");
    }
    return null;
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
  const html = `<p>Your ${appName} verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`;

  const transport = getTransporter();
  // If transport is null (dev fallback), log the code instead of failing.
  if (!transport) {
    console.warn(`OTP code for ${to}: ${code}`);
    return;
  }

  await transport.sendMail({
    from: transport.fromAddress || process.env.APP_EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${appName} verification code`,
    text,
    html,
  });
}

export async function sendVerificationEmail({ to, fullName, link, expiresMinutes = 60, appName = "Wowziri" }) {
  const transport = getTransporter();
  const safeName = fullName || "there";
  const text = [
    `Hi ${safeName},`,
    ``,
    `Thanks for creating a ${appName} account.`,
    `Please confirm your email by clicking the link below:`,
    link,
    ``,
    `For your security, this link expires in ${expiresMinutes} minutes.`,
    ``,
    `If you didn’t request this, you can ignore this email.`,
    ``,
    `— The ${appName} Team`,
  ].join("\n");

  const html = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px;">
      <p style="font-size: 16px;">Hi ${safeName},</p>
      <p style="font-size: 16px; margin-bottom: 12px;">Thanks for creating a ${appName} account.</p>
      <p style="font-size: 16px; margin-bottom: 16px;">Please confirm your email by clicking the button below.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="background: #10a37f; color: white; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Verify my email
        </a>
      </p>
      <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">If the button doesn’t work, copy and paste this link into your browser:</p>
      <p style="font-size: 14px; word-break: break-all; color: #0f172a;">${link}</p>
      <p style="font-size: 14px; color: #475569;">This link expires in ${expiresMinutes} minutes.</p>
      <p style="font-size: 14px; color: #475569; margin-top: 20px;">If you didn’t request this, you can safely ignore this email.</p>
      <p style="font-size: 14px; margin-top: 24px;">— The ${appName} Team</p>
    </div>
  `;

  if (!transport) {
    console.warn(`Verification link for ${to}: ${link}`);
    return;
  }

  await transport.sendMail({
    from: transport.fromAddress || process.env.APP_EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Verify your ${appName} email`,
    text,
    html,
  });
}
