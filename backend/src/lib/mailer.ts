import nodemailer from 'nodemailer';
import { config } from '../config';

let testAccountPromise: Promise<nodemailer.TestAccount> | null = null;

async function getTransporter() {
  let user = config.ethereal.user;
  let pass = config.ethereal.pass;

  if (!user || !pass) {
    if (!testAccountPromise) {
      testAccountPromise = nodemailer.createTestAccount();
    }
    const testAccount = await testAccountPromise;
    user = testAccount.user;
    pass = testAccount.pass;
    console.log(`[Nodemailer] Auto-generated Ethereal Test Account: ${user}`);
  }

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

export interface SendEmailPayload {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
}

export interface SendEmailResult {
  messageId: string;
  etherealPreviewUrl: string | false;
}

export async function sendEmail({
  senderEmail,
  recipientEmail,
  subject,
  bodyText,
}: SendEmailPayload): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: `"ReachInbox Sender" <${senderEmail}>`,
    to: recipientEmail,
    subject,
    text: bodyText,
    html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
      <h2 style="color: #4f46e5;">ReachInbox Scheduled Email</h2>
      <p style="white-space: pre-wrap;">${bodyText}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">Sent via ReachInbox Email Scheduler (Ethereal Test SMTP)</p>
    </div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    etherealPreviewUrl: previewUrl,
  };
}
