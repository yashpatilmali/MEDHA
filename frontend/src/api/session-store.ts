import * as SecureStore from 'expo-secure-store';

import type { Patient } from '@/types/patient';

export type StoredSession = { token: string; patient: Patient };

const TOKEN_KEY = 'sparsh.token';
const PATIENT_KEY = 'sparsh.patient';

/** The login token is kept in the device's secure keychain/keystore. */
export async function loadStoredSession(): Promise<StoredSession | null> {
  const [token, patient] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(PATIENT_KEY),
  ]);
  return token && patient ? { token, patient: JSON.parse(patient) } : null;
}

export async function storeSession({ token, patient }: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(PATIENT_KEY, JSON.stringify(patient)),
  ]);
}

export async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(PATIENT_KEY),
  ]);
}
