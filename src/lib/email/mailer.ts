import nodemailer from 'nodemailer';

export function isGmailSmtpConfigured(): boolean {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s+/g, '');
  return Boolean(user && pass);
}

export function formatWibDateTime(date = new Date()): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB'
  );
}

export async function sendInstitutionalEmail(params: {
  senderLabel: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const smtpUser = process.env.GMAIL_SMTP_USER;
  const smtpPass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s+/g, '');

  if (!smtpUser || !smtpPass) {
    throw new Error('GMAIL_SMTP_USER dan GMAIL_SMTP_APP_PASSWORD belum dikonfigurasi.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"${params.senderLabel}" <${smtpUser}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
