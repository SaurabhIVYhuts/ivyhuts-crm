// Friendly verbs for the tool-activity chips. Keys match the backend tool
// names in api/_lib/assistantTools.js (ivyhuts-website). Anything not listed
// falls back to a generic label so a newly-added backend tool never renders
// a raw snake_case name.

interface ToolLabel {
  /** shown while the tool call is open, with a spinner */
  active: string;
  /** shown once the tool has returned, with a ✓ */
  done: string;
}

const LABELS: Record<string, ToolLabel> = {
  search_leads: { active: "Searching leads", done: "Searched leads" },
  get_lead: { active: "Opening lead", done: "Read lead" },
  my_work_queue: { active: "Checking your work queue", done: "Checked your work queue" },
  get_lead_meetings: { active: "Loading meetings", done: "Read meetings" },
  get_lead_communications: { active: "Loading communications", done: "Read communications" },
  get_lead_follow_ups: { active: "Loading follow-ups", done: "Read follow-ups" },
  search_properties: { active: "Searching accommodation", done: "Searched accommodation" },
  resolve_university: { active: "Looking up the university", done: "Resolved university" },
  lookup_cost_of_living: { active: "Looking up cost of living", done: "Read cost of living" },
  lookup_salaries: { active: "Looking up salary guidance", done: "Read salary guidance" },
};

export function toolLabel(name: string): ToolLabel {
  return LABELS[name] ?? { active: `Running ${name.replace(/_/g, " ")}`, done: `Ran ${name.replace(/_/g, " ")}` };
}
