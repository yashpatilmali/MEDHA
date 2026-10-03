import { AxiosError, create } from 'axios';

import { API_URL } from '@/api/config';
import type { AlertEvent, HistoryPoint, PatchStatus, Snapshot } from '@/types/monitoring';
import type { PatchPosition } from '@/constants/positions';
import type { NewPatient, Patient } from '@/types/patient';
import type { SensorData } from '@/types/sensor';

/** A failed request, with a message to show and, for forms, a message per field. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const http = create({ baseURL: `${API_URL}/api`, timeout: 15000 });

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the server rejects the saved login, so the app can return to the login screen. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function handleUnauthorized() {
  unauthorizedHandler?.();
}

http.interceptors.request.use((request) => {
  if (authToken) {
    request.headers.Authorization = `Bearer ${authToken}`;
  }
  return request;
});

function toApiError(error: unknown) {
  if (error instanceof AxiosError) {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401 && authToken) {
        handleUnauthorized();
      }
      return new ApiError(data?.error ?? `Request failed (${status}).`, status, data?.fields);
    }
    return new ApiError(
      `Can't reach the Sparsh server (${API_URL}). Check your internet connection and that the backend is running.`,
      null
    );
  }
  return new ApiError('Something went wrong. Please try again.', null);
}

async function call<T>(request: Promise<{ data: T }>) {
  try {
    return (await request).data;
  } catch (error) {
    throw toApiError(error);
  }
}

type AuthResponse = { token: string; patient: Patient };

export const api = {
  register: (details: NewPatient) => call<AuthResponse>(http.post('/auth/register', details)),
  login: (contact: string, password: string) =>
    call<AuthResponse>(http.post('/auth/login', { contact, password })),
  me: () => call<{ patient: Patient }>(http.get('/auth/me')),
  forgotPassword: (contact: string) =>
    call<{ message: string }>(http.post('/auth/forgot-password', { contact })),
  resetPassword: (contact: string, code: string, password: string) =>
    call<{ message: string }>(http.post('/auth/reset-password', { contact, code, password })),

  /** Saves a reading for the logged-in patient's device and returns it scored. */
  sendReading: (reading: SensorData) => call<Snapshot>(http.post('/monitoring/readings', reading)),
  device: () => call<PatchStatus>(http.get('/monitoring/device')),
  /** Switches the patch's sensors on; the ESP32 confirms within a few seconds. */
  activate: () => call<PatchStatus>(http.post('/monitoring/device/activate')),
  /** The patient's position, asked once the sensors are on: says where the patch was placed. */
  setPosition: (position: PatchPosition) =>
    call<PatchStatus>(http.post('/monitoring/device/position', { position })),
  /** Switches the sensors off and ends the wear session. */
  deactivate: () => call<PatchStatus>(http.post('/monitoring/device/deactivate')),
  /** Scans the initial readings: the device's next minute of readings becomes the baseline. */
  startCalibration: () => call<PatchStatus>(http.post('/monitoring/calibration')),
  latest: () => call<{ snapshot: Snapshot | null }>(http.get('/monitoring/latest')),
  history: (minutes: number) =>
    call<{ readings: HistoryPoint[] }>(http.get('/monitoring/history', { params: { minutes } })),
  alerts: (limit = 20) =>
    call<{ total: number; alerts: AlertEvent[] }>(http.get('/monitoring/alerts', { params: { limit } })),
};
