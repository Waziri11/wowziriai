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
