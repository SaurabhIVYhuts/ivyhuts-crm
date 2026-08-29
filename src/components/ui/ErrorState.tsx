import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import type { ApiErrorState } from "@/lib/utils/errors";

const ICONS: Record<ApiErrorState["kind"], typeof AlertTriangle> = {
  auth: Lock,
  forbidden: ShieldAlert,
  not_found: AlertTriangle,
  server: AlertTriangle,
  unknown: AlertTriangle,
};

// `onRetry` is optional and additive — every existing call site that omits
// it renders exactly as before. Added in CRM Milestone 16 so a single
// Dashboard section can fail and recover independently (spec §25: "My Work
// / Unable to load work queue. [Retry]") without every other ErrorState
// call site needing to grow a retry affordance it has no use for.
export function ErrorState({ error, onRetry }: { error: ApiErrorState; onRetry?: () => void }) {
  const Icon = ICONS[error.kind];
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
      <Icon className="h-5 w-5 text-red-600 dark:text-red-400" />
      <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
        >
          Retry
        </button>
      )}
    </div>
  );
}
