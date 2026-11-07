import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Menu } from "lucide-react";
import { Show, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Overview", to: "/", testid: "nav-link-home", n: "01" },
  { label: "New Screening", to: "/new-screening", testid: "nav-link-screening", n: "02" },
  { label: "Registry", to: "/patients", testid: "nav-link-patients", n: "03" },
  { label: "Results", to: "/clinical-results", testid: "nav-link-results", n: "04" },
  { label: "Coordination", to: "/care-coordination", testid: "nav-link-coordination", n: "05" },
  { label: "Outreach", to: "/outreach", testid: "nav-link-outreach", n: "06" },
  { label: "Analytics", to: "/analytics", testid: "nav-link-analytics", n: "07" },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-3", className)} data-testid="nav-brand">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B3C6] via-dusty to-rose-deep font-heading text-lg italic text-cream shadow-rose transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-105">
        A
        <span className="absolute inset-[3px] rounded-full border border-cream/40" />
      </span>
      <span className="flex flex-col">
        <span className="font-heading text-[23px] leading-none tracking-tight text-plum">Avenea</span>
        <span className="mt-1 hidden text-[9px] uppercase tracking-[0.3em] text-plum-muted/70 sm:block">
          The path to better health
        </span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 print:hidden">
      <div className="glass-nav mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full py-2 pl-4 pr-2 sm:pl-5">
        <BrandMark />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} data-testid={link.testid} className="relative block">
              {({ isActive }) => (
                <span
                  className={cn(
                    "relative block rounded-full px-3.5 py-2 text-[13px] tracking-wide transition-colors duration-300",
                    isActive ? "font-medium text-rose-ink" : "text-plum-muted hover:text-plum",
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-[#F6D3DF] via-blush to-[#F8E4E0] ring-1 ring-dusty/30"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative">{link.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Show when="signed-in">
            <span data-testid="nav-user-menu" className="flex items-center">
              <UserButton />
            </span>
          </Show>
          <Button
            className="hidden rounded-full bg-gradient-to-r from-rose-deep to-[#A55A7A] px-5 shadow-rose transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-rose-lg sm:inline-flex"
            onClick={() => navigate("/new-screening")}
            data-testid="nav-cta-start-screening"
          >
            Start Screening
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-rose-border bg-cream/70 xl:hidden"
                  data-testid="nav-mobile-button"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="surface-rose w-[86vw] max-w-sm overflow-y-auto border-0 p-7">
              <SheetTitle className="font-heading text-2xl italic text-plum">Avenea</SheetTitle>
              <nav className="mt-8 flex flex-col" aria-label="Mobile">
                {LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    data-testid={`${link.testid}-mobile`}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-baseline gap-4 border-b border-dusty/20 py-3.5 transition-colors",
                        isActive ? "text-rose-ink" : "text-plum hover:text-rose-ink",
                      )
                    }
                  >
                    <span className="font-heading text-xs italic text-dusty">{link.n}</span>
                    <span className="font-heading text-2xl tracking-tight">{link.label}</span>
                  </NavLink>
                ))}
              </nav>
              <Button
                className="mt-8 w-full rounded-full"
                onClick={() => {
                  setOpen(false);
                  navigate("/new-screening");
                }}
                data-testid="nav-mobile-cta"
              >
                Start Screening
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
