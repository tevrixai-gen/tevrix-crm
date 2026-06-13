import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-slate-50 text-slate-600 border-slate-200",
  connected: "bg-cyan-50 text-cyan-700 border-cyan-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  callback: "bg-amber-50 text-amber-700 border-amber-200",
  not_answered: "bg-orange-50 text-orange-600 border-orange-200",
  not_interested: "bg-slate-50 text-slate-500 border-slate-200",
  dnc: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-yellow-50 text-yellow-700 border-yellow-200",
  draft: "bg-slate-50 text-slate-500 border-slate-200",
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ready: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const LABELS: Record<string, string> = {
  not_answered: "No Answer",
  not_interested: "Not Interested",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
