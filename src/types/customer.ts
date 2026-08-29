// Mirrors api/_lib/customerView.js's `toSafeCustomer` projection in the
// ivyhuts-website backend — the MongoDB `User` document (business profile),
// not the Redis auth record. See src/types/auth.ts for the distinction.

export const ACCOMMODATION_JOURNEY_STATUSES = [
  "LEAD",
  "ENQUIRY",
  "BOOKING_IN_PROGRESS",
  "BOOKED",
  "STAY_IN_PROGRESS",
  "MOVED_IN",
  "STAY_COMPLETED",
  "CANCELLED",
] as const;

export type AccommodationJourneyStatus = (typeof ACCOMMODATION_JOURNEY_STATUSES)[number];

export interface AccommodationJourney {
  status: AccommodationJourneyStatus;
  servicePurchased: boolean;
  purchasedAt: string | null;
  moveInDate: string | null;
  expectedStayDurationMonths: number | null;
  expectedMoveOutDate: string | null;
  actualMoveInDate: string | null;
  actualMoveOutDate: string | null;
}

export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: import("./auth").Role;
  profile: {
    country: string | null;
    city: string | null;
    preferredCountries: string[];
    preferredCities: string[];
    otherPreferences: Record<string, unknown>;
  };
  marketing: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    subscribed: boolean;
    consent: boolean;
    consentAt: string | null;
  };
  lead: {
    status: string;
    score: number;
    assignedTo: string | null;
    temperature: string;
  };
  accommodationJourney: AccommodationJourney;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
