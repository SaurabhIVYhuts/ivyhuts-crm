import { redirect } from "next/navigation";

// Minimal landing route. The dashboard itself checks authentication
// client-side (see src/app/dashboard/page.tsx) and bounces to /login if
// there's no session — this page just picks a starting point.
export default function Home() {
  redirect("/dashboard");
}
