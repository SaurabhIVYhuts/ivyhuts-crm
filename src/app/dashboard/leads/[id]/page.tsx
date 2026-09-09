"use client";

// Everything for a lead happens here, on this one page: contact details,
// status and assignment, requirements (Discovery), meetings, rooms and
// saved properties, WhatsApp / communications, and follow-ups. There is no
// tab bar and no right-hand sidebar — the Sales Journey at the top doubles
// as the in-page nav (clicking a stage scrolls to its section), so an agent
// scrolls one column instead of hunting through panels.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, History, MessageCircle } from "lucide-react";
import { getLead } from "@/lib/api/leads";
import { useAuth } from "@/hooks/useAuth";
import type { LeadDetail } from "@/types/lead";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { LeadStatusControl } from "@/components/leads/LeadStatusControl";
import { LeadAssignmentControl } from "@/components/leads/LeadAssignmentControl";
import { PartnerAvailabilityControl } from "@/components/leads/PartnerAvailabilityControl";
import { SalesJourney } from "@/components/leads/SalesJourney";
import { MeetingsSection } from "@/components/meetings/MeetingsSection";
import { DiscoverySection } from "@/components/discovery/DiscoverySection";
import { FindRoomsSection } from "@/components/find-rooms/FindRoomsSection";
import { SavedPropertiesCard } from "@/components/leads/SavedPropertiesCard";
import { CommunicationsSection } from "@/components/communications/CommunicationsSection";
import { FollowUpsSection } from "@/components/follow-ups/FollowUpsSection";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDate, formatDateTime, formatLabel } from "@/lib/utils/format";

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    // scroll-mt accounts for the sticky header when a Sales Journey stage
    // scrolls a section into view.
    <section id={id} className="scroll-mt-20">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
        {children}
      </Card>
    </section>
  );
}

// Milestone 23.12 Part 14 — reads one field out of Lead.sourceDetails
// (Record<string, unknown>, backend Mixed type) as a display string, never
// fabricating a value the webhook didn't actually provide. `sourceDetails`
// itself can arrive as undefined even though the schema defaults it to {}
// — Mongoose's toObject() (used by toSafeLead on the backend) strips empty
// Mixed-type objects entirely (its default `minimize` behavior).
function sourceDetailString(sourceDetails: Record<string, unknown> | undefined, key: string): string {
  const value = sourceDetails?.[key];
  return typeof value === "string" && value.trim() ? value : "Not available";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
}

function buildTimeline(lead: LeadDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [{ date: lead.createdAt, label: "Lead created" }];

  if (lead.firstContactAt) {
    events.push({ date: lead.firstContactAt, label: "First contact" });
  }
  if (lead.lastContactAt && lead.lastContactAt !== lead.firstContactAt) {
    events.push({ date: lead.lastContactAt, label: "Last contact" });
  }
  lead.enquiries.forEach((enquiry) => {
    events.push({
      date: enquiry.createdAt,
      label: "Enquiry received",
      detail: [formatLabel(enquiry.status), enquiry.source ? formatLabel(enquiry.source) : null].filter(Boolean).join(" · "),
    });
  });
  if (lead.convertedAt) {
    events.push({ date: lead.convertedAt, label: "Converted" });
  }
  if (lead.lostAt) {
    events.push({ date: lead.lostAt, label: "Lost", detail: lead.lostReason || undefined });
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<ApiErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLead(params.id)
      .then((res) => {
        if (!cancelled) {
          setLead(res.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function handleUpdated(updated: Partial<LeadDetail>) {
    setLead((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link href="/dashboard/leads" className="flex w-fit items-center gap-1.5 text-sm text-subtle hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} />
      ) : lead ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Avatar name={lead.contact.name} size="lg" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-ink">{lead.contact.name || "Unnamed lead"}</h1>
                <p className="text-sm text-subtle">
                  Arrived {formatDate(lead.createdAt)}
                  {lead.contact.email ? ` · ${lead.contact.email}` : ""}
                  {lead.contact.phone ? ` · ${lead.contact.phone}` : ""}
                </p>
              </div>
            </div>
            <StatusBadge status={lead.status} />
          </div>

          {/* CRM Milestone 14 — a customer reply is an event, not a
              lifecycle status: derived from two timestamps already on this
              same Lead object. If the most recent contact event was itself
              inbound, nothing outbound has happened since. */}
          {lead.lastInboundCommunicationAt && lead.lastInboundCommunicationAt === lead.lastContactAt && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
              <MessageCircle className="h-4 w-4 shrink-0" />
              Customer replied — awaiting your response.
            </div>
          )}

          {/* Doubles as this page's in-page nav — every stage scrolls to
              its own section below. */}
          <Card>
            <SalesJourney lead={lead} />
          </Card>

          <Section title="Lead Information" id="lead-information">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Name" value={lead.contact.name || "—"} />
              <Field label="Phone" value={lead.contact.phone || "—"} />
              <Field label="Email" value={lead.contact.email || "—"} />
              <Field label="Source" value={lead.source ? formatLabel(lead.source) : "—"} />
              <Field label="City" value={lead.property.city || "—"} />
              <Field label="Property" value={lead.property.name || "—"} />
              <Field label="Temperature" value={formatLabel(lead.temperature)} />
              <Field label="Arrived" value={formatDateTime(lead.createdAt)} />
              {/* Milestone 23.12 Part 14 — only for a real Facebook-origin
                  lead (source === "facebook_lead_ads", set by the Meta
                  webhook). Each value comes straight from
                  Lead.sourceDetails — "Not available" when a value
                  genuinely wasn't provided, never guessed. */}
              {lead.source === "facebook_lead_ads" && (
                <>
                  <Field label="Campaign" value={sourceDetailString(lead.sourceDetails, "campaignId")} />
                  <Field label="Ad" value={sourceDetailString(lead.sourceDetails, "adId")} />
                  <Field label="Form" value={sourceDetailString(lead.sourceDetails, "formId")} />
                </>
              )}
            </dl>

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Status</h3>
                <LeadStatusControl lead={lead} onUpdated={handleUpdated} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Assignment</h3>
                <LeadAssignmentControl lead={lead} onUpdated={handleUpdated} />
              </div>
            </div>
          </Section>

          <Section title="Summary & Partner Availability" id="partner-availability">
            <PartnerAvailabilityControl lead={lead} onUpdated={handleUpdated} />
          </Section>

          <Section title="Discovery" id="discovery">
            <DiscoverySection leadId={lead.id} />
          </Section>

          <Section title="Meetings" id="meeting">
            <MeetingsSection leadId={lead.id} role={profile?.role ?? null} />
          </Section>

          <Section title="Find Rooms" id="find-rooms">
            <FindRoomsSection leadId={lead.id} />
          </Section>

          <Section title="Saved Properties" id="saved-properties">
            <SavedPropertiesCard leadId={lead.id} />
          </Section>

          <Section title="Communication History" id="communications">
            <CommunicationsSection leadId={lead.id} phone={lead.contact.phone} leadName={lead.contact.name} />
          </Section>

          <Section title="Follow-ups" id="follow-ups">
            <FollowUpsSection leadId={lead.id} />
          </Section>

          <Section title="Timeline" id="activity">
            <ul className="flex flex-col gap-3">
              {buildTimeline(lead).map((event, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <History className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                  <div>
                    <div className="text-ink">
                      {event.label}
                      {event.detail && <span className="text-subtle"> · {event.detail}</span>}
                    </div>
                    <div className="text-xs text-faint">{formatDateTime(event.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
    </div>
  );
}
