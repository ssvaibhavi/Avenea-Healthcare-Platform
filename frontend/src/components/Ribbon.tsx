import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Variant = "hero" | "header" | "band" | "footer";

interface RibbonSet {
  viewBox: string;
  wide: string[];
  fine: string[];
  trail: string;
}

/* Flowing silk ribbons + fine path lines — Avenea's "beautiful path" motif. */
const SETS: Record<Variant, RibbonSet> = {
  hero: {
    viewBox: "0 0 1440 900",
    wide: [
      "M-120 780 C 240 640, 430 860, 730 620 S 1180 250, 1560 300",
      "M-120 560 C 200 440, 500 660, 780 480 S 1240 120, 1560 150",
    ],
    fine: [
      "M-60 840 C 300 700, 470 880, 770 660 S 1210 330, 1520 370",
      "M-60 640 C 260 520, 520 720, 800 540 S 1230 200, 1520 230",
      "M-60 470 C 230 380, 520 560, 820 420 S 1250 80, 1520 90",
    ],
    trail: "M-60 720 C 280 590, 470 800, 750 580 S 1200 230, 1520 260",
  },
  header: {
    viewBox: "0 0 1440 460",
    wide: ["M-120 380 C 260 260, 520 440, 820 300 S 1260 80, 1560 120"],
    fine: [
      "M-60 420 C 280 300, 540 470, 840 330 S 1270 120, 1520 150",
      "M-60 330 C 260 230, 560 390, 860 260 S 1280 40, 1520 60",
    ],
    trail: "M-60 370 C 270 260, 540 430, 840 290 S 1270 90, 1520 110",
  },
  band: {
    viewBox: "0 0 1200 520",
    wide: ["M-100 430 C 220 300, 420 480, 680 320 S 1060 90, 1320 130"],
    fine: [
      "M-60 470 C 240 350, 440 510, 700 360 S 1070 140, 1280 170",
      "M-60 380 C 230 270, 460 430, 720 280 S 1080 60, 1280 80",
    ],
    trail: "M-60 420 C 240 310, 440 480, 700 330 S 1070 110, 1280 140",
  },
  footer: {
    viewBox: "0 0 1440 520",
    wide: ["M-120 140 C 260 260, 520 80, 820 220 S 1260 420, 1560 360"],
    fine: [
      "M-60 100 C 280 220, 540 40, 840 180 S 1270 380, 1520 330",
      "M-60 200 C 260 300, 560 140, 860 270 S 1280 470, 1520 430",
    ],
    trail: "M-60 160 C 270 270, 540 100, 840 230 S 1270 420, 1520 380",
  },
};

interface RibbonProps {
  variant?: Variant;
  className?: string;
  tone?: "rose" | "light";
}

export function Ribbon({ variant = "header", className, tone = "rose" }: RibbonProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const set = SETS[variant];
  const wideId = `rw${uid}`;
  const fineId = `rf${uid}`;
  const blurId = `rb${uid}`;
  const light = tone === "light";

  return (
    <svg
      viewBox={set.viewBox}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={wideId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light ? "#DFA3B8" : "#F5D6E2"} stopOpacity="0" />
          <stop offset="0.35" stopColor={light ? "#DFA3B8" : "#DFA3B8"} />
          <stop offset="0.7" stopColor={light ? "#F6EADF" : "#C989A2"} />
          <stop offset="1" stopColor="#F6EADF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={fineId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C989A2" stopOpacity="0" />
          <stop offset="0.3" stopColor={light ? "#DFA3B8" : "#C989A2"} />
          <stop offset="0.75" stopColor={light ? "#F5D6E2" : "#8A4A67"} />
          <stop offset="1" stopColor="#5E8B77" stopOpacity="0" />
        </linearGradient>
        <filter id={blurId} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <g className="ribbon-sway">
        {set.wide.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke={`url(#${wideId})`}
            strokeWidth={i === 0 ? 86 : 54}
            strokeLinecap="round"
            filter={`url(#${blurId})`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: light ? 0.16 : 0.32 }}
            transition={{ duration: 2.4, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {set.fine.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke={`url(#${fineId})`}
            strokeWidth={1.2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: light ? 0.45 : 0.6 }}
            transition={{ duration: 2.8, delay: 0.3 + 0.18 * i, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        <path
          d={set.trail}
          stroke={light ? "#F5D6E2" : "#B5607F"}
          strokeOpacity={light ? 0.5 : 0.55}
          strokeWidth={1.6}
          strokeDasharray="2 12"
          strokeLinecap="round"
          className="ribbon-flow"
        />
        <circle r="5" fill={light ? "#F5D6E2" : "#B5607F"}>
          <animateMotion dur="16s" repeatCount="indefinite" path={set.trail} />
        </circle>
        <circle r="14" fill={light ? "#F5D6E2" : "#DFA3B8"} opacity="0.35">
          <animateMotion dur="16s" repeatCount="indefinite" path={set.trail} />
        </circle>
      </g>
    </svg>
  );
}

/** Ornamental divider: a short flowing line with a centred rose node. */
export function RibbonDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)} aria-hidden>
      <svg viewBox="0 0 240 24" className="h-6 w-40 sm:w-60" fill="none">
        <path d="M0 12 C 40 2, 80 22, 120 12" stroke="#C989A2" strokeOpacity="0.6" strokeWidth="1.2" />
      </svg>
      <span className="h-2 w-2 rotate-45 bg-gradient-to-br from-rose-soft to-rose-deep" />
      <svg viewBox="0 0 240 24" className="h-6 w-40 sm:w-60" fill="none">
        <path d="M120 12 C 160 2, 200 22, 240 12" stroke="#C989A2" strokeOpacity="0.6" strokeWidth="1.2" transform="translate(-120 0)" />
      </svg>
    </div>
  );
}
