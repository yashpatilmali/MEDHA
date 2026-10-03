import nodemailer from 'nodemailer';

import { config } from '../config.js';
import { isEmail } from './contact.js';
import { sendSms } from './sms.js';

const transport = config.smtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

/**
 * Texts the code to a mobile-number account (through Twilio, or the server log without it).
 * Emails it to an older email account when SMTP is configured; otherwise the code is written to
 * the server log, where whoever runs the server can read it out to the patient.
 */
export async function sendResetCode(contact, code, minutesValid) {
  if (!isEmail(contact)) {
    await sendSms(
      contact,
      `Your Medha password reset code is ${code}. It expires in ${minutesValid} minutes.`
    );
    return;
  }
  if (transport && isEmail(contact)) {
    await transport.sendMail({
      from: config.smtp.from,
      to: contact,
      subject: 'Your Sparsh password reset code',
      text:
        `Your Sparsh password reset code is ${code}.\n\n` +
        `It expires in ${minutesValid} minutes. If you didn't ask to reset your password, ignore this email.`,
    });
    return;
  }
  console.log(`[password reset] Code for ${contact}: ${code} (expires in ${minutesValid} minutes)`);
}
