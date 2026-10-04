import { Suspense } from "react";
import { LeadListView } from "@/components/leads/LeadListView";

// Good Leads — leads an agent rated Good. Same grid as the Lead Inbox
// (/dashboard/leads); changing the rating moves the lead to that rating's
// page, and "Not rated" sends it back to Leads.
//
// Suspense for LeadListView's useSearchParams — see the inbox page.
export default function GoodLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadListView scope="good" />
    </Suspense>
  );
}
