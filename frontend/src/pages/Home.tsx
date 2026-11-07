import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PublicStats } from "@/types";
import { HeroVisual } from "@/components/HeroVisual";
import { Reveal } from "@/components/Reveal";
import { Ribbon, RibbonDivider } from "@/components/Ribbon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    n: "01",
    title: "Screen early",
    copy: "A guided five-step intake gathers demographics, vitals, lifestyle and symptoms in minutes, whether at the doorstep, in a camp or at the sub-centre.",
  },
  {
    n: "02",
    title: "Understand risk",
    copy: "A transparent demo heuristic sorts every visit into a low, moderate or high tier and explains each flag in plain language.",
  },
  {
    n: "03",
    title: "Coordinate & refer",
    copy: "Findings flow straight into a referral pathway, from pending to scheduled to completed, so nobody falls through the cracks.",
  },
  {
    n: "04",
    title: "Follow through",
    copy: "Field teams track every referral to completion and keep a gentle, continuous record of each person's journey.",
  },
];

const STEPS = [
  {
    n: "I",
    title: "Register & screen",
    copy: "Create a patient or choose one from the registry, then record vitals, lifestyle and symptoms in one calm, guided flow.",
    offset: "md:mt-0",
  },
  {
    n: "II",
    title: "See the risk picture",
    copy: "Findings are sorted into low, moderate and high tiers. Each tier is clearly labelled as a demo heuristic, never a diagnosis.",
    offset: "md:mt-28",
  },
  {
    n: "III",
    title: "Coordinate the next step",
    copy: "Referrals move to the care board, get a coordinator and a date, and are followed through to completed care.",
    offset: "md:mt-10",
  },
];

const TOUR = [
  { n: "03", title: "Patient Registry", copy: "A dossier card for every person in the demo community, showing screening status, risk and referral at a glance.", to: "/patients" },
  { n: "04", title: "Clinical Results", copy: "Every screening with its vitals, flags and risk score, filterable by tier.", to: "/clinical-results" },
  { n: "05", title: "Care Coordination", copy: "A three-stage referral board with coordinators, due dates and gentle overdue cues.", to: "/care-coordination" },
  { n: "07", title: "Analytics", copy: "Soft rose curves and honest numbers, all drawn from synthetic demo data.", to: "/analytics" },
];

function LiveStats() {
  const { data, isPending } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => apiGet<PublicStats>("/public/stats"),
  });
  const t = data?.totals;
  const items = [
    { value: t ? String(t.screenings) : "—", label: "Screenings completed" },
    { value: t ? String(t.communities) : "—", label: "Communities served" },
    { value: t ? String(t.open_referrals) : "—", label: "Open referrals" },
    { value: t ? String(t.patients) : "—", label: "People in registry" },
  ];
  return (
    <div data-testid="home-stats-strip">
      <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.label}
            data-testid="home-stat"
            className={cn("pr-4", i > 0 && "sm:border-l sm:border-dusty/25 sm:pl-6", i === 2 && "border-l-0 sm:border-l")}
          >
            <p className={cn("font-heading text-4xl tracking-tight text-plum sm:text-[44px]", isPending && "animate-pulse text-rose-soft")}>
              {item.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-plum-muted">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11px] text-plum-muted/60">These are live counts from the demo environment. Every record is synthetic.</p>
    </div>
  );
}

function SectionEyebrow({ n, children }: { n: string; children: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-heading text-sm italic text-rose-deep">N° {n}</span>
      <span className="h-px w-14 bg-gradient-to-r from-dusty to-transparent" />
      <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-dusty">{children}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative">
      {/* ——— Hero ——— */}
      <section className="relative isolate -mt-[76px] min-h-[100svh] pt-[76px]">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blush via-[#FBE7EE] to-transparent" />
          <div className="absolute -left-40 top-20 h-[560px] w-[560px] animate-drift rounded-full bg-rose-tint blur-3xl" />
          <div className="absolute right-[-10%] top-[-10%] h-[640px] w-[640px] animate-glow rounded-full bg-rose-soft/40 blur-3xl" />
          <Ribbon variant="hero" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8 lg:px-8 lg:pt-20">
          <div>
            <Reveal>
              <SectionEyebrow n="01">Avenea · Preventive care</SectionEyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-8 font-heading text-[54px] leading-[0.98] tracking-[-0.025em] text-plum sm:text-7xl xl:text-[92px]">
                A <em className="ink-rose italic">beautiful</em>
                <br />
                path to better
                <br />
                health.
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-8 max-w-lg border-l border-dusty/40 pl-5 text-lg leading-relaxed text-plum-muted">
                Preventive screening, care coordination, and dignified healthcare support for underserved communities.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/new-screening"
                  data-testid="hero-cta-start-screening"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "group h-12 rounded-full bg-gradient-to-r from-rose-deep to-[#A55A7A] px-8 text-[15px] shadow-rose-lg transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5",
                  )}
                >
                  Start Screening
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#philosophy"
                  data-testid="hero-cta-explore"
                  className="group inline-flex h-12 items-center gap-2 rounded-full px-4 font-heading text-lg italic text-plum transition-colors duration-300 hover:text-rose-deep"
                >
                  Explore Avenea
                  <span className="h-px w-8 bg-plum/50 transition-[width,background-color] duration-500 group-hover:w-14 group-hover:bg-rose-deep" />
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.32}>
              <div className="mt-14 max-w-xl">
                <LiveStats />
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.2} y={36}>
            <HeroVisual />
          </Reveal>
        </div>

        <motion.div
          aria-hidden
          className="mx-auto hidden w-fit flex-col items-center gap-2 pb-10 lg:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <span className="text-[10px] uppercase tracking-[0.4em] text-plum-muted/70">Scroll</span>
          <motion.span
            className="h-10 w-px bg-gradient-to-b from-dusty to-transparent"
            animate={{ scaleY: [0.3, 1, 0.3], originY: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ——— Editorial word band ——— */}
      <section aria-hidden className="relative overflow-hidden py-10">
        <p className="whitespace-nowrap text-center font-heading text-[clamp(40px,7.4vw,150px)] italic leading-[1.15] tracking-tight">
          <span className="text-outline">Prevention</span>
          <span className="mx-[0.2em] text-dusty/50">·</span>
          <span className="ink-rose">Dignity</span>
          <span className="mx-[0.2em] text-dusty/50">·</span>
          <span className="text-outline">Care</span>
        </p>
      </section>

      {/* ——— Philosophy (numbered editorial list) ——— */}
      <section id="philosophy" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <Reveal>
              <SectionEyebrow n="02">The Avenea philosophy</SectionEyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-heading text-5xl leading-[1.04] tracking-[-0.02em] text-plum sm:text-6xl">
                Care that flows like a <em className="ink-rose italic">path</em>, not a queue.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-plum-muted">
                Four quiet principles shape every screen in Avenea: gentle to use in the field, precise enough for clinics,
                and dignified for the people at their centre.
              </p>
            </Reveal>
          </div>
          <div>
            {PILLARS.map((p, i) => (
              <Reveal key={p.n} delay={0.06 * i}>
                <article
                  className="group relative grid grid-cols-[auto_1fr] gap-6 border-t border-dusty/25 py-10 sm:gap-10"
                  data-testid={`home-pillar-${i}`}
                >
                  <span className="text-outline font-heading text-[72px] italic leading-[0.8] transition-colors duration-500 group-hover:text-rose-soft/40 sm:text-[104px]">
                    {p.n}
                  </span>
                  <div className="pt-2">
                    <h3 className="font-heading text-3xl tracking-tight text-plum transition-colors duration-300 group-hover:text-rose-deep">
                      {p.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-plum-muted">{p.copy}</p>
                  </div>
                  <span className="absolute -top-px left-0 h-px w-0 bg-gradient-to-r from-rose-deep to-rose-soft transition-[width] duration-700 group-hover:w-full" />
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <RibbonDivider className="mt-24" />

      {/* ——— The path ——— */}
      <section id="the-path" className="relative mx-auto max-w-7xl scroll-mt-28 px-4 pt-24 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <SectionEyebrow n="03">How Avenea works</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-6 font-heading text-5xl leading-[1.04] tracking-[-0.02em] text-plum sm:text-6xl">
              Three gentle steps, one <em className="ink-rose italic">continuous</em> path.
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-16">
          <svg viewBox="0 0 1200 360" preserveAspectRatio="none" className="absolute inset-x-0 top-6 hidden h-[300px] w-full md:block" fill="none" aria-hidden>
            <motion.path
              d="M40 40 C 240 40, 260 250, 520 250 S 820 90, 1160 110"
              stroke="url(#pathStepGrad)"
              strokeWidth="2"
              strokeDasharray="3 11"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            />
            <defs>
              <linearGradient id="pathStepGrad" x1="0" y1="0" x2="1" y2="0">
                <stop stopColor="#DFA3B8" />
                <stop offset="0.6" stopColor="#B5607F" />
                <stop offset="1" stopColor="#5E8B77" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative grid gap-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={0.12 * i} className={step.offset}>
                <div className="relative">
                  <span aria-hidden className="text-outline absolute -top-10 left-12 -z-10 font-heading text-[120px] italic leading-none">
                    {step.n}
                  </span>
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B3C6] via-dusty to-rose-deep font-heading text-lg italic text-cream shadow-rose-lg ring-8 ring-blush/70">
                    {step.n}
                  </span>
                  <h3 className="mt-7 font-heading text-3xl tracking-tight text-plum">{step.title}</h3>
                  <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-plum-muted">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.2}>
          <div className="mt-16">
            <Link
              to="/new-screening"
              data-testid="path-cta-start-screening"
              className={cn(buttonVariants({ size: "lg" }), "group h-12 rounded-full px-8 shadow-rose")}
            >
              Walk the path and start a screening
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ——— Editorial plum band ——— */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <Reveal>
          <div className="surface-plum relative isolate overflow-hidden rounded-[3rem] px-8 py-20 text-cream sm:px-16 lg:py-24">
            <Ribbon variant="band" tone="light" className="-z-10 opacity-80" />
            <span aria-hidden className="text-outline-light pointer-events-none absolute -left-4 -top-16 font-heading text-[320px] leading-none">
              “
            </span>
            <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-rose-soft">Why Avenea exists</p>
                <blockquote className="mt-6 font-heading text-4xl leading-[1.15] tracking-tight sm:text-5xl">
                  Dignity is preventive care offered early, and offered <em className="ink-blush italic">beautifully.</em>
                </blockquote>
              </div>
              <div>
                <p className="text-sm leading-relaxed text-mauve-pale/75">
                  In underserved communities, illness is too often found late. Avenea gives community health workers a calm,
                  elegant place to screen early, refer wisely and follow through, so care reaches people while it can still
                  change their path.
                </p>
                <Link
                  to="/outreach"
                  data-testid="band-cta-outreach"
                  className="group mt-8 inline-flex items-center gap-2 font-heading text-lg italic text-rose-soft transition-colors hover:text-cream"
                >
                  See how outreach works
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ——— Inside Avenea: editorial index ——— */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <Reveal>
              <SectionEyebrow n="04">Inside Avenea</SectionEyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-heading text-5xl leading-[1.04] tracking-[-0.02em] text-plum sm:text-6xl">
                Every page, <em className="ink-rose italic">pink</em> and purposeful.
              </h2>
            </Reveal>
          </div>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          {TOUR.map((card, i) => (
            <Reveal key={card.title} delay={0.07 * i} className={i === 0 ? "md:col-span-4 md:row-span-2" : i === 3 ? "md:col-span-6 lg:col-span-2" : "md:col-span-2"}>
              <Link
                to={card.to}
                data-testid={`home-tour-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "group relative isolate flex h-full flex-col overflow-hidden rounded-[2.25rem] border p-8 transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-rose-lg sm:p-10",
                  i === 0 ? "surface-rose min-h-[340px]" : "surface-silk",
                )}
              >
                {i === 0 ? <Ribbon variant="band" className="-z-10 opacity-60" /> : null}
                <span className="text-outline font-heading text-[64px] italic leading-none sm:text-[80px]">{card.n}</span>
                <h3 className={cn("mt-auto font-heading tracking-tight text-plum", i === 0 ? "pt-16 text-4xl sm:text-5xl" : "pt-8 text-2xl")}>
                  {card.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-plum-muted">{card.copy}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-heading text-base italic text-rose-ink">
                  Open
                  <span className="h-px w-6 bg-rose-ink/60 transition-[width] duration-500 group-hover:w-12" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ——— Closing ——— */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <Reveal>
          <div className="surface-rose relative isolate overflow-hidden rounded-[3rem] px-8 py-20 text-center sm:px-16">
            <Ribbon variant="band" className="-z-10" />
            <span aria-hidden className="text-outline pointer-events-none absolute inset-x-0 top-6 -z-10 select-none font-heading text-[clamp(100px,18vw,240px)] italic leading-none">
              Begin
            </span>
            <div className="relative">
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-rose-deep">Begin today</p>
              <h2 className="mx-auto mt-6 max-w-3xl font-heading text-5xl leading-[1.04] tracking-[-0.02em] text-plum sm:text-6xl">
                The first step is a single, <em className="ink-rose italic">gentle</em> screening.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base text-plum-muted">
                Create a synthetic demo patient and walk the full flow, from doorstep vitals to a tracked referral.
              </p>
              <Link
                to="/new-screening"
                data-testid="closing-cta-start-screening"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group mt-10 h-12 rounded-full bg-gradient-to-r from-rose-deep to-[#A55A7A] px-10 shadow-rose-lg transition-[transform] duration-300 hover:-translate-y-0.5",
                )}
              >
                Start Screening
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
