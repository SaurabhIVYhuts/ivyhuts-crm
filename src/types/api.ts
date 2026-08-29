// Shared response envelopes for the Milestone 2+ business API
// (api/customers/*, api/leads/*, api/enquiries/* in the ivyhuts-website
// backend — see api/_lib/apiResponse.js there). The legacy api/auth/*
// endpoints use a different `{ ok, ... }` shape instead; see
// src/lib/auth/session.ts for those.

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiCollectionResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
