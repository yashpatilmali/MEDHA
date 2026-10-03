const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+?\d{10,15}$/;

/**
 * Returns the login identifier in canonical form (a lowercase email address, or a mobile number
 * with spaces, dashes, dots and brackets removed), or null if it is neither.
 */
export function normalizeContact(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return EMAIL_PATTERN.test(email) ? email : null;
  }
  const mobile = value.replace(/[\s().-]/g, '');
  return MOBILE_PATTERN.test(mobile) ? mobile : null;
}

export function isEmail(contact) {
  return contact.includes('@');
}
