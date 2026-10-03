export const SEX_OPTIONS = ['Male', 'Female', 'Other'] as const;

export type Sex = (typeof SEX_OPTIONS)[number];

/** The person texted when readings reach ATTENTION or CRITICAL. */
export interface Caretaker {
  name: string;
  /** Mobile number (digits, optional leading +). */
  phone: string;
}

export interface Patient {
  /** Assigned at registration: SP001, SP002, … */
  id: string;
  name: string;
  age: number;
  sex: Sex;
  /** The email address (lowercase) or mobile number (digits, optional leading +) used to log in. */
  contact: string;
  /** Monitoring device assigned at registration: SP-ESP32-001, … */
  deviceId: string;
  /** Null for accounts made before caretakers were asked for. */
  caretaker: Caretaker | null;
  /** When the account was created, as an ISO 8601 string. */
  createdAt: string;
}

/** What a patient fills in on the signup screen. */
export interface NewPatient {
  name: string;
  age: number;
  sex: Sex;
  contact: string;
  password: string;
  caretakerName: string;
  caretakerPhone: string;
}
