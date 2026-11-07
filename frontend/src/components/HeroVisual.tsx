import { motion } from "motion/react";
import { HeartPulse, MapPin, Users } from "lucide-react";

/**
 * The hero's sculptural composition: a velvety organic 3D render inside a soft
 * blob frame, a glowing dashed "path" arcing upward, floating frosted stat
 * cards, and ambient rose glows. All metrics are synthetic demo figures.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" data-testid="hero-visual">
      {/* Ambient glows */}
      <div aria-hidden className="absolute -left-12 -top-8 h-72 w-72 animate-glow rounded-full bg-rose-soft/50 blur-3xl" />
      <div
        aria-hidden
        className="absolute -right-10 bottom-0 h-80 w-80 animate-drift rounded-full bg-champagne/80 blur-3xl"
      />
      <div aria-hidden className="absolute left-1/3 top-1/2 h-56 w-56 animate-glow rounded-full bg-mauve-pale/70 blur-3xl" />

      {/* Glowing path motif */}
      <svg viewBox="0 0 520 620" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="heroPath" x1="0" y1="620" x2="520" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C989A2" />
            <stop offset="0.55" stopColor="#DFA3B8" />
            <stop offset="1" stopColor="#5E8B77" />
          </linearGradient>
        </defs>
        <motion.path
          d="M70 560 C 190 505, 130 330, 285 265 S 470 150, 452 62"
          stroke="url(#heroPath)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 12"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.6, ease: "easeOut", delay: 0.4 }}
        />
        <motion.circle
          cx="452"
          cy="62"
          r="6"
          fill="#5E8B77"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 1 }}
          transition={{ delay: 2.6, duration: 0.6 }}
        />
        <circle cx="452" cy="62" r="12" fill="#5E8B77" opacity="0.18" className="animate-glow" />
        <circle cx="285" cy="265" r="5" fill="#C989A2" opacity="0.7" className="animate-glow" />
        <circle cx="70" cy="560" r="5" fill="#C989A2" opacity="0.7" className="animate-glow" />
      </svg>

      {/* Sculpture */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 26 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <div
          aria-hidden
          className="blob-b absolute inset-0 translate-x-3 translate-y-4 border border-rose-border/70 bg-rose-tint/50"
        />
        <div className="blob-a relative overflow-hidden border border-white/70 shadow-rose-lg">
          <img
            src="/hero-sculpture.jpg"
            alt="Soft sculptural pink forms rising along a glowing path — Avenea's brand visual"
            className="h-full w-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#F5D6E2]/30 via-transparent to-transparent" />
        </div>
      </motion.div>

      {/* Floating glass stat cards — synthetic demo figures */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel absolute -right-3 top-10 animate-float rounded-2xl px-4 py-3 shadow-rose sm:-right-8"
        style={{ animationDelay: "0.6s" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCECEF]">
            <HeartPulse className="h-4 w-4 text-rose-ink" />
          </span>
          <div>
            <p className="font-heading text-lg leading-none text-plum">94.2%*</p>
            <p className="mt-1 text-[11px] text-plum-muted">Early risk catch rate</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel absolute -left-3 bottom-16 animate-float rounded-2xl px-4 py-3 shadow-rose sm:-left-10"
        style={{ animationDelay: "1.4s" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-soft">
            <Users className="h-4 w-4 text-sage-deep" />
          </span>
          <div>
            <p className="font-heading text-lg leading-none text-plum">4,200+*</p>
            <p className="mt-1 text-[11px] text-plum-muted">Rural screenings guided</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel absolute right-6 bottom-2 flex animate-float items-center gap-2 rounded-full px-4 py-2.5 shadow-rose sm:right-0"
        style={{ animationDelay: "2.2s" }}
      >
        <MapPin className="h-3.5 w-3.5 text-dusty" />
        <p className="text-xs font-medium text-plum">18 clinic hubs*</p>
      </motion.div>

      <p className="mt-4 text-right text-[11px] text-plum-muted/60">*Synthetic demo metrics</p>
    </div>
  );
}