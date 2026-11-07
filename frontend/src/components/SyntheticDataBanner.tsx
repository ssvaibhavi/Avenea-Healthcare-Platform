import { Sparkles } from "lucide-react";

/** Slim disclaimer shown on every page that renders demo records. */
export function SyntheticDataBanner({ className }: { className?: string }) {
  return (
    <div
      className={
        "inline-flex items-center gap-2 rounded-full border border-rose-border bg-cream/80 px-4 py-2 text-xs leading-snug text-plum-muted " +
        (className ?? "")
      }
      data-testid="demo-data-banner"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-dusty" />
      <span>
        <strong className="font-semibold text-rose-ink">Synthetic demonstration data</strong> — no real
        patients; nothing here is clinically validated.
      </span>
    </div>
  );
}
