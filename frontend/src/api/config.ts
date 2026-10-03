import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Sparsh backend runs. Set EXPO_PUBLIC_API_URL in frontend/.env to use a deployed
 * backend. Without it, during development the app looks for the backend on port 4000 of the
 * computer running `npx expo start`.
 */
function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const devHost =
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? 'localhost'
        : window.location.hostname
      : (Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost');
  return `http://${devHost}:4000`;
}

export const API_URL = resolveApiUrl();
