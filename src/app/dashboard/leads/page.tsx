import { Suspense } from "react";
import { LeadListView } from "@/components/leads/LeadListView";

// The Lead Inbox — leads nobody has contacted yet (status New), plus lost
// leads in red. Once an agent moves a lead to Contacted or beyond, it
// moves to Good Leads, which renders this exact view.
//
// LeadListView reads the Dashboard's deep-link params with useSearchParams,
// which requires a Suspense boundary — see node_modules/next/dist/docs/
// 01-app/03-api-reference/04-functions/use-search-params.md's
// "Prerendering" section.
export default function LeadInboxPage() {
  return (
    <Suspense fallback={null}>
      <LeadListView scope="inbox" />
    </Suspense>
  );
}
