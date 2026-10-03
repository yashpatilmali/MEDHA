import { config } from '../config.js';

/** "+919876543210" from "9876543210", "09876543210" or "+919876543210". */
export function toInternational(phone) {
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/^0+/, '');
  return digits.length > 10 ? `+${digits}` : `${config.smsCountryCode}${digits}`;
}

/**
 * Texts `phone` through Twilio when it is configured. Otherwise the message is written to the
 * server log, so alerts can still be seen while testing.
 */
export async function sendSms(phone, body) {
  const to = toInternational(phone);
  const twilio = config.twilio;
  if (!twilio) {
    console.log(`[sms] To ${to}: ${body}`);
    return;
  }

  const credentials = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: twilio.from, Body: body }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Twilio refused the SMS to ${to} (${response.status}): ${error.message ?? ''}`);
  }
}
