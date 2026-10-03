import { createContext, use, useEffect, useRef, useState, type PropsWithChildren } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import {
  clearStoredSession,
  loadStoredSession,
  storeSession,
  type StoredSession,
} from '@/api/session-store';
import type { NewPatient, Patient } from '@/types/patient';
import { DEMO_MODE, DEMO_PATIENT, DEMO_TOKEN } from '@/constants/demo';

type Session = {
  /** True until the saved login has been read from the device. */
  isLoading: boolean;
  /** The logged-in patient, or null when logged out. */
  patient: Patient | null;
  /** The login token, for the live monitoring connection. */
  token: string | null;
  signIn: (contact: string, password: string) => Promise<void>;
  signUp: (details: NewPatient) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = use(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return session;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(!DEMO_MODE);
  const [current, setCurrent] = useState<StoredSession | null>(
    DEMO_MODE ? { token: DEMO_TOKEN, patient: DEMO_PATIENT } : null
  );
  // The active token, readable from async callbacks that finish after a logout.
  const activeToken = useRef<string | null>(null);

  async function startSession(session: StoredSession) {
    activeToken.current = session.token;
    setAuthToken(session.token);
    setCurrent(session);
    await storeSession(session);
  }

  async function endSession() {
    activeToken.current = null;
    setAuthToken(null);
    setCurrent(null);
    await clearStoredSession();
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      endSession().catch((error) => console.warn('Could not clear the session:', error));
    });

    if (DEMO_MODE) {
      activeToken.current = DEMO_TOKEN;
      setAuthToken(DEMO_TOKEN);
      return () => setUnauthorizedHandler(null);
    }

    // Open straight to the saved patient (works offline), then refresh their profile in the
    // background. If the server no longer accepts the token, the handler above logs them out.
    loadStoredSession()
      .then((stored) => {
        if (!stored) return;
        activeToken.current = stored.token;
        setAuthToken(stored.token);
        setCurrent(stored);
        api
          .me()
          .then(({ patient }) => {
            if (activeToken.current === stored.token) {
              return startSession({ token: stored.token, patient });
            }
          })
          .catch(() => {});
      })
      .catch((error) => console.warn('Could not restore the saved session:', error))
      .finally(() => setIsLoading(false));

    return () => setUnauthorizedHandler(null);
  }, []);

  const session: Session = {
    isLoading,
    patient: current?.patient ?? null,
    token: current?.token ?? null,
    signIn: async (contact, password) => startSession(await api.login(contact, password)),
    signUp: async (details) => startSession(await api.register(details)),
    signOut: endSession,
  };

  return <SessionContext value={session}>{children}</SessionContext>;
}
