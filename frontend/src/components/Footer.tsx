import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Ribbon } from "@/components/Ribbon";

const PLATFORM_LINKS = [
  { label: "New Screening", to: "/new-screening", testid: "footer-link-screening" },
  { label: "Patient Registry", to: "/patients", testid: "footer-link-patients" },
  { label: "Clinical Results", to: "/clinical-results", testid: "footer-link-results" },
  { label: "Care Coordination", to: "/care-coordination", testid: "footer-link-coordination" },
  { label: "Outreach", to: "/outreach", testid: "footer-link-outreach" },
  { label: "Analytics", to: "/analytics", testid: "footer-link-analytics" },
];

export default function Footer() {
  return (
    <footer className="surface-plum relative isolate mt-28 overflow-hidden rounded-t-[3.5rem] px-6 pt-20 text-cream sm:px-12 print:hidden">
      <Ribbon variant="footer" tone="light" className="-z-10 opacity-70" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-4">
              <span className="h-px w-14 bg-gradient-to-r from-rose-soft to-transparent" />
              <p className="text-[11px] uppercase tracking-[0.32em] text-rose-soft">Avenea</p>
            </div>
            <p className="mt-6 max-w-xl font-heading text-4xl leading-[1.1] tracking-tight text-cream sm:text-5xl">
              A beautiful path to <em className="ink-blush italic">better health.</em>
            </p>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-mauve-pale/70">
              Preventive screening, care coordination, and dignified healthcare support for underserved communities,
              built for community health workers, clinics, and NGOs.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
            {PLATFORM_LINKS.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                data-testid={link.testid}
                className="group flex items-baseline gap-3 border-b border-cream/10 py-3 text-sm text-mauve-pale/80 transition-colors duration-300 hover:text-rose-soft"
              >
                <span className="font-heading text-xs italic text-rose-soft/70">0{i + 2}</span>
                {link.label}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-[opacity,transform] duration-300 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 text-xs leading-relaxed text-mauve-pale/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Avenea. A product concept built for demonstration.</p>
          <p className="sm:text-right">
            Every patient, screening, and metric here is <span className="text-rose-soft">synthetic demo data</span>. These
            are not real patients, and nothing is clinically validated.
          </p>
        </div>
      </div>

      <p
        aria-hidden
        className="text-outline-light pointer-events-none mt-6 select-none whitespace-nowrap text-center font-heading text-[clamp(96px,22vw,320px)] italic leading-[0.78] tracking-tight"
      >
        Avenea
      </p>
    </footer>
  );
}