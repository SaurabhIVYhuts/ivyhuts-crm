import { DISCOVERY_PRIORITY_FACTORS, REQUIREMENT_SOURCES, type DiscoveryPriorityFactor, type DiscoveryUniversitySnapshot, type RequirementSource, type RequirementSources } from "@/types/discovery";
import { UniversityResolverField } from "./UniversityResolverField";

export interface DiscoveryFormValues {
  university: string;
  universityResolved: DiscoveryUniversitySnapshot | null;
  course: string;
  intake: string;
  budgetMin: string;
  budgetMax: string;
  // Required (enforced backend-side) whenever budgetMin/budgetMax is set —
  // see src/types/discovery.ts's own comment on why this is never assumed.
  currency: string;
  moveInDate: string;
  stayDurationMonths: string;
  preferredLocation: string;
  roomPreference: string;
  // Number of people sharing (Milestone 23.7) — distinct from
  // roomPreference (a free-text room-TYPE descriptor). See
  // src/types/discovery.ts's DiscoveryAccommodation.sharing comment.
  sharing: string;
  distancePreference: string;
  priorities: DiscoveryPriorityFactor[];
  notes: string;
  // Milestone 23.10 — where each of the three core requirements came
  // from. Purely descriptive metadata the agent sets alongside the value;
  // never derived or guessed by this form itself.
  requirementSources: RequirementSources;
}

const SOURCE_LABELS: Record<RequirementSource, string> = {
  lead_form: "Lead form",
  agent: "Agent",
  meeting: "Meeting",
  transcript: "Transcript",
};

function SourceSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: RequirementSource | null;
  onChange: (value: RequirementSource | null) => void;
  disabled: boolean;
}) {
  return (
 <label className="flex items-center gap-1.5 text-xs text-subtle dark:text-faint">
      <span>{label} source:</span>
      <select
 className="rounded border border-line bg-transparent px-1.5 py-0.5 text-xs outline-none focus:border-accent dark:border-line"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? (e.target.value as RequirementSource) : null)}
      >
        <option value="">Not set</option>
        {REQUIREMENT_SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

export const PRIORITY_LABELS: Record<DiscoveryPriorityFactor, string> = {
  budget: "Budget",
  distance: "Distance to university",
  travel_convenience: "Travel convenience",
  amenities: "Amenities",
  location: "Location",
  property_quality: "Property quality",
  other: "Other",
};

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line";
const labelClass = "text-xs font-medium text-subtle dark:text-faint";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
 <label className="flex flex-col gap-1">
 <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function DiscoveryForm({
  values,
  onChange,
  disabled,
}: {
  values: DiscoveryFormValues;
  onChange: (values: DiscoveryFormValues) => void;
  disabled: boolean;
}) {
  function set<K extends keyof DiscoveryFormValues>(key: K, value: DiscoveryFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function setSource(key: keyof RequirementSources, value: RequirementSource | null) {
    onChange({ ...values, requirementSources: { ...values.requirementSources, [key]: value } });
  }

  function togglePriority(factor: DiscoveryPriorityFactor) {
    const has = values.priorities.includes(factor);
    set(
      "priorities",
      has ? values.priorities.filter((p) => p !== factor) : [...values.priorities, factor]
    );
  }

  return (
 <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-60">
      <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Student
        </h3>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div className="flex flex-col gap-1">
            <UniversityResolverField
              value={values.university}
              onChange={(v) => set("university", v)}
              resolved={values.universityResolved}
              onResolvedChange={(r) => set("universityResolved", r)}
              disabled={disabled}
            />
            <SourceSelect label="University" value={values.requirementSources.university} onChange={(v) => setSource("university", v)} disabled={disabled} />
          </div>
          <Field label="Course">
            <input
 className={inputClass}
              value={values.course}
              onChange={(e) => set("course", e.target.value)}
            />
          </Field>
          <Field label="Intake">
            <input
 className={inputClass}
              placeholder="e.g. September 2026"
              value={values.intake}
              onChange={(e) => set("intake", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Accommodation
        </h3>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Budget min">
            <input
              type="number"
              min={0}
 className={inputClass}
              value={values.budgetMin}
              onChange={(e) => set("budgetMin", e.target.value)}
            />
          </Field>
          <Field label="Budget max">
            <input
              type="number"
              min={0}
 className={inputClass}
              value={values.budgetMax}
              onChange={(e) => set("budgetMax", e.target.value)}
            />
          </Field>
 <div className="flex flex-col gap-1">
            <Field label="Currency">
              <input
 className={inputClass}
                placeholder="e.g. GBP, USD, EUR"
                value={values.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
              />
            </Field>
            <SourceSelect label="Budget" value={values.requirementSources.budget} onChange={(v) => setSource("budget", v)} disabled={disabled} />
          </div>
 <div className="flex flex-col gap-1">
            <Field label="Sharing (people)">
              <input
                type="number"
                min={1}
                max={20}
                step={1}
 className={inputClass}
                placeholder="e.g. 2"
                value={values.sharing}
                onChange={(e) => set("sharing", e.target.value)}
              />
            </Field>
            <SourceSelect label="Sharing" value={values.requirementSources.sharing} onChange={(v) => setSource("sharing", v)} disabled={disabled} />
          </div>
          <Field label="Move-in date">
            <input
              type="date"
 className={inputClass}
              value={values.moveInDate}
              onChange={(e) => set("moveInDate", e.target.value)}
            />
          </Field>
          <Field label="Stay duration (months)">
            <input
              type="number"
              min={0}
 className={inputClass}
              value={values.stayDurationMonths}
              onChange={(e) => set("stayDurationMonths", e.target.value)}
            />
          </Field>
          <Field label="Preferred location">
            <input
 className={inputClass}
              value={values.preferredLocation}
              onChange={(e) => set("preferredLocation", e.target.value)}
            />
          </Field>
          <Field label="Room preference">
            <input
 className={inputClass}
              placeholder="e.g. ensuite, studio, shared bathroom"
              value={values.roomPreference}
              onChange={(e) => set("roomPreference", e.target.value)}
            />
            {/* Distinct from Sharing above — this describes the room TYPE
                (ensuite/studio/shared bathroom), never a people-count. */}
          </Field>
          <Field label="Distance preference">
            <input
 className={inputClass}
              placeholder="e.g. walking distance, 15 min bus"
              value={values.distancePreference}
              onChange={(e) => set("distancePreference", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Priorities
        </h3>
 <p className="mb-2 text-xs text-subtle dark:text-faint">What matters most to the student?</p>
 <div className="flex flex-wrap gap-x-4 gap-y-2">
          {DISCOVERY_PRIORITY_FACTORS.map((factor) => (
 <label key={factor} className="flex items-center gap-1.5 text-sm text-subtle dark:text-subtle">
              <input
                type="checkbox"
                checked={values.priorities.includes(factor)}
                onChange={() => togglePriority(factor)}
 className="h-3.5 w-3.5 rounded border-line dark:border-line"
              />
              {PRIORITY_LABELS[factor]}
            </label>
          ))}
        </div>
      </div>

      <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Requirements / Notes
        </h3>
        <textarea
          rows={4}
 className={inputClass}
          placeholder="Anything else useful from the conversation…"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </fieldset>
  );
}
