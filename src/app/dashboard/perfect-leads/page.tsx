import { Suspense } from "react";
import { LeadListView } from "@/components/leads/LeadListView";

// Perfect Leads — leads an agent rated Perfect. Same grid as the Lead Inbox
// (/dashboard/leads); see good-leads/page.tsx.
//
// Suspense for LeadListView's useSearchParams — see the inbox page.
export default function PerfectLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadListView scope="perfect" />
    </Suspense>
  );
}
