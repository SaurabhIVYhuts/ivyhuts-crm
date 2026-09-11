import { Suspense } from "react";
import { LeadListView } from "@/components/leads/LeadListView";

// Good Leads — contacted, qualified, nurturing and converted leads. Same
// grid as the Lead Inbox (/dashboard/leads); a lead arrives here when its
// status moves past New, and goes back to Leads if it's marked Lost.
//
// Suspense for LeadListView's useSearchParams — see the inbox page.
export default function GoodLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadListView scope="good" />
    </Suspense>
  );
}
