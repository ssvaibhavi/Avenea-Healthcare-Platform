import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, GraduationCap, MapPin, Megaphone, NotebookPen, Truck, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { AnalyticsSummary } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { Reveal } from "@/components/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Sample programme content — clearly labelled as demo below. */
const DRIVES = [
  {
    day: "18 Feb",
    icon: Truck,
    title: "Mobile screening van — Sonapur circuit",
    location: "Sonapur market ground",
    team: "4 health workers · 1 nurse",
    focus: "Blood pressure & glucose screening",
    status: "Scheduled",
  },
  {
    day: "22 Feb",
    icon: Megaphone,
    title: "Maternal health morning — Hariyali",
    location: "Hariyali community hall",
    team: "2 ANMs · 1 counsellor",
    focus: "Antenatal check-ins & education",
    status: "Scheduled",
  },
  {
    day: "26 Feb",
    icon: Users,
    title: "Elder care afternoon — Rampur",
    location: "Rampur sub-centre",
    team: "3 health workers",
    focus: "Follow-up visits for referred elders",
    status: "Planning",
  },
];

const EDUCATION = [
  {
    icon: GraduationCap,
    title: "Blood pressure awareness",
    copy: "A gentle hour of salt, stress and story — helping neighbours read their own numbers before trouble reads them.",
  },
  {
    icon: NotebookPen,
    title: "Maternal health basics",
    copy: "Danger signs, rest and nutrition, shared in the local tongue by the ANMs women already trust.",
  },
];

const FIELD_NOTES = [
  {
    quote: "The van reached the haat by nine. By noon we had screened forty-one neighbours and referred three for clinic review.",
    who: "Field team · Sonapur circuit",
  },
  {
    quote: "Ladies who once walked two hours now meet us at the community hall. Early checks feel less like fear, more like ritual.",
    who: "ANM coordinator · Hariyali",
  },
];

export default function Outreach() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary"),
  });

  const last7 = (data?.screenings_by_day ?? []).slice(-7).reduce((acc, d) => acc + d.count, 0);
  const chips = [
    { label: "Screenings in the last 7 days", value: data ? String(last7) : "—" },
    { label: "Communities served", value: data ? String(data.totals.communities) : "—" },
    { label: "Open referrals", value: data ? String(data.totals.open_referrals) : "—" },
  ];

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-blush/80 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Community outreach"
          index="06"
          word="Outreach"
          title={
            <>
              Take screening to the <em className="italic ink-rose">last mile.</em>
            </>
          }
          description="Field drives, mobile vans and education mornings — the gentle machinery that brings care to people who cannot come to it."
        />
        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SyntheticDataBanner />
            <p className="text-xs text-plum-muted/70">The programme calendar below is sample content for the demo.</p>
          </div>
        </Reveal>

        {/* Live chips */}
        <Reveal delay={0.24}>
          <div className="mt-8 grid gap-4 sm:grid-cols-3" data-testid="outreach-live-chips">
            {chips.map((chip) => (
              <div key={chip.label} className="surface-silk rounded-3xl border p-5 shadow-rose">
                <p className="font-heading text-3xl tracking-tight text-plum">{chip.value}</p>
                <p className="mt-1.5 text-sm text-plum-muted">{chip.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Field drives */}
        <section className="pt-20">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-dusty">Field schedule</p>
                <h2 className="mt-3 font-heading text-3xl tracking-tight text-plum sm:text-4xl">This month's drives</h2>
              </div>
              <CalendarDays className="hidden h-8 w-8 text-dusty/60 sm:block" />
            </div>
          </Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {DRIVES.map((drive, i) => (
              <Reveal key={drive.title} delay={0.06 * i} y={18}>
                <article
                  className="group flex h-full flex-col surface-silk rounded-[2rem] border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-rose-lg"
                  data-testid={`outreach-drive-${i}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-2xl bg-rose-tint/70 px-4 py-2 text-center">
                      <span className="block font-heading text-lg leading-none text-rose-ink">{drive.day}</span>
                    </span>
                    <drive.icon className="h-5 w-5 text-dusty" />
                  </div>
                  <h3 className="mt-5 font-heading text-xl leading-snug tracking-tight text-plum">{drive.title}</h3>
                  <dl className="mt-4 flex-1 space-y-2 text-sm text-plum-muted">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-dusty/80" />
                      {drive.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-dusty/80" />
                      {drive.team}
                    </div>
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 text-dusty/80" />
                      {drive.focus}
                    </div>
                  </dl>
                  <span
                    className={cn(
                      "mt-5 inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium",
                      drive.status === "Scheduled"
                        ? "border-sage/30 bg-sage-soft text-sage-deep"
                        : "border-[#E4CDB4] bg-champagne text-[#75543D]",
                    )}
                  >
                    {drive.status}
                  </span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Education drives */}
        <section className="pt-20">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-dusty">Education mornings</p>
            <h2 className="mt-3 font-heading text-3xl tracking-tight text-plum sm:text-4xl">Learning, softly spoken</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {EDUCATION.map((edu, i) => (
              <Reveal key={edu.title} delay={0.08 * i} y={18}>
                <article
                  className={cn(
                    "flex h-full items-start gap-5 rounded-[2rem] border border-rose-border p-8",
                    i % 2 === 0 ? "bg-rose-tint/50" : "bg-champagne/60",
                  )}
                  data-testid={`outreach-education-${i}`}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream shadow-rose">
                    <edu.icon className="h-5 w-5 text-rose-deep" />
                  </span>
                  <div>
                    <h3 className="font-heading text-2xl tracking-tight text-plum">{edu.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-plum-muted">{edu.copy}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Field notes */}
        <section className="pt-20">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-dusty">From the field</p>
            <h2 className="mt-3 font-heading text-3xl tracking-tight text-plum sm:text-4xl">Notes from the path</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {FIELD_NOTES.map((note, i) => (
              <Reveal key={note.who} delay={0.08 * i} y={18}>
                <blockquote
                  className="flex h-full flex-col rounded-[2rem] bg-plum p-8 text-cream"
                  data-testid={`outreach-field-note-${i}`}
                >
                  <p className="flex-1 font-heading text-xl italic leading-relaxed text-mauve-pale">“{note.quote}”</p>
                  <footer className="mt-6 text-xs uppercase tracking-[0.18em] text-rose-soft">{note.who}</footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Reveal>
          <div className="mt-20 flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-rose-border bg-gradient-to-br from-rose-tint via-blush to-champagne p-10 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-heading text-3xl tracking-tight text-plum">Bring Avenea to your next camp.</h2>
              <p className="mt-2 max-w-lg text-sm text-plum-muted">
                Every drive feeds the same gentle pipeline — screening, results, coordination.
              </p>
            </div>
            <Link
              to="/new-screening"
              data-testid="outreach-cta-screening"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}
            >
              Start Screening
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
