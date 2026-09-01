import type { NextConfig } from "next";

// The backend (ivyhuts-website — https://www.ivyhuts.com) lives on a
// different site than this CRM. A browser will not persist or replay the
// session cookie across that boundary (it's cross-site: *.vercel.app vs
// *.ivyhuts.com), which broke login: POST /api/auth/login succeeded but the
// very next GET /api/auth/me came back 401.
//
// Fix: proxy the backend through THIS app's own origin. Every /api/* request
// the browser makes now goes to the CRM's origin (same-origin — no CORS,
// no cross-site cookie), and Next forwards it server-side to the real
// backend, passing Set-Cookie / Cookie straight through. The session cookie
// becomes first-party to the CRM origin and just works.
//
// BACKEND_ORIGIN is server-side only (NOT NEXT_PUBLIC_*) — it's read here at
// build/runtime for the rewrite target, never shipped to the browser.
// Defaults to production; override in .env.local for local dev
// (http://localhost:3001, matching ivyhuts-website/scripts/local-api-server.js).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "https://www.ivyhuts.com";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
