import { REFERRAL_LABELS, RISK_LABELS } from "@/lib/constants";
import type { ReferralStatus, RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "border-sage/30 bg-sage-soft text-sage-deep",
  moderate: "border-[#E4CDB4] bg-champagne text-[#75543D]",
  high: "border-[#F0C6D3] bg-[#FCECEF] text-rose-ink",
};

const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-sage",
  moderate: "bg-[#C9A279]",
  high: "bg-rose-ink",
};

export function RiskPill({ level, className }: { level: RiskLevel | null; className?: string }) {
  if (!level) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        RISK_STYLES[level],
        className,
      )}
      data-testid={`risk-pill-${level}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", RISK_DOT[level])} />
      {RISK_LABELS[level]}
    </span>
  );
}

const REFERRAL_STYLES: Record<ReferralStatus, string> = {
  none: "border-rose-border bg-mauve-pale text-plum-muted",
  pending: "border-[#F0C6D3] bg-[#FCECEF] text-rose-ink",
  scheduled: "border-[#E4CDB4] bg-champagne text-[#75543D]",
  completed: "border-sage/30 bg-sage-soft text-sage-deep",
};

export function ReferralPill({ status, className }: { status: ReferralStatus | null; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        REFERRAL_STYLES[status],
        className,
      )}
      data-testid={`referral-pill-${status}`}
    >
      {REFERRAL_LABELS[status]}
    </span>
  );
}

export function ScreeningStatusPill({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        count > 0 ? "border-sage/30 bg-sage-soft text-sage-deep" : "border-[#E4CDB4] bg-champagne text-[#75543D]",
        className,
      )}
      data-testid={count > 0 ? "screening-status-screened" : "screening-status-awaiting"}
    >
      {count > 0 ? "Screened" : "Awaiting screening"}
    </span>
  );
}
