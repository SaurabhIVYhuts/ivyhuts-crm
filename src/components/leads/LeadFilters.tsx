import { LEAD_STATUSES } from "@/types/lead";
import type { StaffUser } from "@/types/staff";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatLabel } from "@/lib/utils/format";

export interface LeadFilterValues {
  search: string;
  status: string;
  source: string;
  assignedTo: string;
}

const selectClass =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function LeadFilters({
  values,
  onChange,
  sourceOptions,
  staffOptions,
}: {
  values: LeadFilterValues;
  onChange: (values: LeadFilterValues) => void;
  sourceOptions: string[];
  staffOptions: StaffUser[];
}) {
  const hasActiveFilters = values.search || values.status || values.source || values.assignedTo;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={values.search}
        onChange={(v) => onChange({ ...values, search: v })}
        placeholder="Search by name or email"
        className="w-64"
      />

      <select value={values.status} onChange={(e) => onChange({ ...values, status: e.target.value })} className={selectClass}>
        <option value="">All statuses</option>
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatLabel(status)}
          </option>
        ))}
      </select>

      <select value={values.source} onChange={(e) => onChange({ ...values, source: e.target.value })} className={selectClass}>
        <option value="">All sources</option>
        {sourceOptions.map((source) => (
          <option key={source} value={source}>
            {formatLabel(source)}
          </option>
        ))}
      </select>

      <select value={values.assignedTo} onChange={(e) => onChange({ ...values, assignedTo: e.target.value })} className={selectClass}>
        <option value="">All agents</option>
        <option value="unassigned">Unassigned</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange({ search: "", status: "", source: "", assignedTo: "" })}
          className="text-sm font-medium text-accent-strong hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
