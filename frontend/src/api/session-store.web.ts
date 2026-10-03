import type { Patient } from '@/types/patient';

export type StoredSession = { token: string; patient: Patient };

const KEY = 'sparsh.session';

/** Browsers have no secure store; the session lives in localStorage. */
export async function loadStoredSession(): Promise<StoredSession | null> {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function storeSession(session: StoredSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  localStorage.removeItem(KEY);
}
