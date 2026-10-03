const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+?\d{10,15}$/;

/** Mirrors the backend's check, so forms can flag a bad email/mobile before submitting. */
export function isValidContact(input: string) {
  const value = input.trim();
  return value.includes('@')
    ? EMAIL_PATTERN.test(value)
    : MOBILE_PATTERN.test(value.replace(/[\s().-]/g, ''));
}

export function isEmail(contact: string) {
  return contact.includes('@');
}
