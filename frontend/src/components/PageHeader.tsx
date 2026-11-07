import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import { Ribbon } from "@/components/Ribbon";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Chapter number, e.g. "02". */
  index?: string;
  /** Oversized outlined editorial word drawn behind the header. */
  word?: string;
}

/** Editorial chapter header for the inner pages: ribbons, oversized word, serif title. */
export function PageHeader({ eyebrow, title, description, actions, className, index, word }: PageHeaderProps) {
  return (
    <header className={cn("relative isolate pb-4 pt-6 sm:pt-10", className)}>
      {/* Full-bleed ribbon field */}
      <div aria-hidden className="absolute -top-40 bottom-[-120px] left-1/2 -z-10 w-screen -translate-x-1/2">
        <Ribbon variant="header" />
      </div>
      <div aria-hidden className="absolute -top-32 right-[-8%] -z-10 h-[420px] w-[420px] animate-glow rounded-full bg-rose-soft/30 blur-3xl" />

      {word ? (
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-10 right-0 -z-10 select-none whitespace-nowrap font-heading text-[clamp(80px,13vw,200px)] italic leading-none tracking-tight opacity-55"
          data-testid="page-header-word"
        >
          {word}
        </span>
      ) : null}

      <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <Reveal>
            <div className="flex items-center gap-4">
              {index ? (
                <span className="font-heading text-sm italic text-rose-deep" data-testid="page-header-index">
                  N° {index}
                </span>
              ) : null}
              <span className="h-px w-14 bg-gradient-to-r from-dusty to-transparent" />
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-dusty">{eyebrow}</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 font-heading text-[44px] leading-[1.02] tracking-[-0.02em] text-plum sm:text-6xl lg:text-[76px]">
              {title}
            </h1>
          </Reveal>
          {description ? (
            <Reveal delay={0.16}>
              <p className="mt-7 max-w-xl border-l border-dusty/40 pl-5 text-base leading-relaxed text-plum-muted sm:text-lg">
                {description}
              </p>
            </Reveal>
          ) : null}
        </div>
        {actions ? (
          <Reveal delay={0.2} className="flex shrink-0 items-center gap-3">
            {actions}
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
