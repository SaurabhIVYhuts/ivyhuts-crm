import { Suspense } from "react";
import { LeadListView } from "@/components/leads/LeadListView";

// Bad Leads — leads an agent rated Bad. Same grid as the Lead Inbox
// (/dashboard/leads); see good-leads/page.tsx.
//
// Suspense for LeadListView's useSearchParams — see the inbox page.
export default function BadLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadListView scope="bad" />
    </Suspense>
  );
}
