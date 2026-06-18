import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@tevrixai.com";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: SendMailOptions) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[email] SMTP not configured — would have sent "${subject}" to ${to}`);
    return;
  }

  await transporter.sendMail({
    from: `"Tevrix AI" <${FROM}>`,
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]*>/g, ""),
  });
}
