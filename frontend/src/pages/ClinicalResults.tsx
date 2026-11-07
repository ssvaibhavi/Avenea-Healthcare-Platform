import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Droplets, Gauge, HeartPulse, Info } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import type { RiskLevel, Screening } from "@/types";
import { SEX_LABELS, SYMPTOM_LABELS, calcBmi, formatDate, initials } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { ReferralPill, RiskPill } from "@/components/StatusPill";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface VitalChip {
  icon: typeof HeartPulse;
  label: string;
  value: string;
  flagged: boolean;
}

function vitalChips(s: Screening): VitalChip[] {
  const bmi = calcBmi(s.vitals);
  const chips: VitalChip[] = [];
  if (s.vitals.systolic && s.vitals.diastolic) {
    chips.push({
      icon: Gauge,
      label: "Blood pressure",
      value: `${s.vitals.systolic}/${s.vitals.diastolic} mmHg`,
      flagged: s.vitals.systolic >= 140 || s.vitals.diastolic >= 90,
    });
  }
  if (s.vitals.pulse) {
    chips.push({ icon: HeartPulse, label: "Pulse", value: `${s.vitals.pulse} bpm`, flagged: s.vitals.pulse > 100 });
  }
  if (s.vitals.glucose) {
    chips.push({
      icon: Droplets,
      label: "Fasting glucose",
      value: `${s.vitals.glucose} mg/dL`,
      flagged: s.vitals.glucose >= 140,
    });
  }
  if (bmi) {
    chips.push({ icon: Info, label: "BMI (demo)", value: String(bmi), flagged: bmi >= 30 || bmi < 18.5 });
  }
  return chips;
}

const RISK_TABS = ["all", "low", "moderate", "high"] as const;
type RiskTab = (typeof RISK_TABS)[number];

export default function ClinicalResults() {
  const [risk, setRisk] = useState<RiskTab>("all");
  const queryClient = useQueryClient();

  const { data: screenings, isPending } = useQuery({
    queryKey: ["screenings"],
    queryFn: () => apiGet<Screening[]>("/screenings"),
  });

  const refer = useMutation({
    mutationFn: (id: string) =>
      apiPatch<Screening>(`/screenings/${id}/referral`, { referral_status: "pending" as const }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`Referral opened for ${s.patient_name}`, {
        description: "It now appears on the Care Coordination board.",
      });
    },
    onError: (e) => toast.error("Could not open the referral", { description: String((e as Error).message) }),
  });

  const filtered = useMemo(
    () => (screenings ?? []).filter((s) => risk === "all" || s.risk_level === risk),
    [screenings, risk],
  );

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-rose-tint/60 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Clinical results"
          index="04"
          word="Results"
          title={
            <>
              Every visit, <em className="italic ink-rose">clearly read.</em>
            </>
          }
          description="Screening records with vitals, plain-language flags and the demo risk score — filterable by tier."
        />
        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SyntheticDataBanner />
            <p className="text-xs text-plum-muted/70">Risk tiers come from a transparent demo heuristic — not a diagnosis.</p>
          </div>
        </Reveal>

        <Reveal delay={0.24}>
          <Tabs value={risk} onValueChange={(v: string) => setRisk(v as RiskTab)} className="mt-8">
            <TabsList variant="line" data-testid="results-risk-tabs">
              {RISK_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} data-testid={`results-tab-${tab}`} className="capitalize">
                  {tab === "all" ? "All results" : tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Reveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-2" data-testid="results-list">
          {isPending
            ? [0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-[2rem] bg-mauve-pale/60" />)
            : filtered.map((s, i) => (
                <Reveal key={s.id} delay={0.05 * (i % 4)} y={18}>
                  <Card className="h-full surface-silk border transition-all duration-300 hover:shadow-rose" data-testid={`result-card-${i}`}>
                    <CardContent className="relative flex h-full flex-col overflow-hidden p-6 sm:p-7">
                      <span aria-hidden className="text-outline pointer-events-none absolute -right-2 -top-6 select-none font-heading text-[120px] italic leading-none">
                        {s.risk_score}
                      </span>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-soft to-rose-deep font-heading text-base italic text-cream">
                            {initials(s.patient_name)}
                          </span>
                          <div>
                            <p className="font-heading text-xl tracking-tight text-plum">{s.patient_name}</p>
                            <p className="mt-0.5 text-xs text-plum-muted">
                              {s.patient_age} yrs · {SEX_LABELS[s.patient_sex]}
                              {s.community ? ` · ${s.community}` : ""} · {formatDate(s.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-full border border-rose-border bg-mauve-pale px-3 py-1 font-mono text-xs text-plum-muted"
                            data-testid="result-score"
                          >
                            score {s.risk_score}
                          </span>
                          <RiskPill level={s.risk_level} />
                        </div>
                      </div>

                      {/* Risk meter */}
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mauve-pale" data-testid="result-meter">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            s.risk_level === "high" ? "bg-rose-ink" : s.risk_level === "moderate" ? "bg-dusty" : "bg-sage",
                          )}
                          style={{ width: `${Math.min((s.risk_score / 12) * 100, 100)}%` }}
                        />
                      </div>

                      {/* Vitals */}
                      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="result-vitals">
                        {vitalChips(s).map((chip) => (
                          <div
                            key={chip.label}
                            className={cn(
                              "rounded-2xl border px-3 py-2.5",
                              chip.flagged ? "border-[#F0C6D3] bg-[#FCECEF]" : "border-rose-border bg-mauve-pale/50",
                            )}
                          >
                            <p
                              className={cn(
                                "flex items-center gap-1 text-[10px] uppercase tracking-wider",
                                chip.flagged ? "text-rose-ink" : "text-plum-muted/80",
                              )}
                            >
                              {chip.flagged ? <AlertCircle className="h-3 w-3" /> : null}
                              {chip.label}
                            </p>
                            <p className={cn("mt-1 text-sm font-medium", chip.flagged ? "text-rose-ink" : "text-plum")}>
                              {chip.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Flags */}
                      {s.flags.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2" data-testid="result-flags">
                          {s.flags.map((flag) => (
                            <span
                              key={flag}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C6D3] bg-[#FCECEF] px-3 py-1 text-xs text-rose-ink"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {flag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Symptoms + notes */}
                      <p className="mt-4 text-xs text-plum-muted" data-testid="result-symptoms">
                        {s.symptoms.length > 0
                          ? `Symptoms: ${s.symptoms.map((k) => SYMPTOM_LABELS[k] ?? k).join(", ")}`
                          : "No symptoms reported"}
                      </p>
                      {s.notes ? <p className="mt-2 text-sm italic text-plum-muted">“{s.notes}”</p> : null}

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-rose-border/60 pt-4 mt-5">
                        <ReferralPill status={s.referral_status} />
                        {s.referral_status === "none" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refer.mutate(s.id)}
                            disabled={refer.isPending}
                            data-testid={`refer-button-${s.id}`}
                            className="rounded-full"
                          >
                            Refer for follow-up
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
        </div>

        {!isPending && filtered.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-rose-soft/70 bg-cream/70 p-12 text-center" data-testid="results-empty">
            <p className="font-heading text-2xl text-plum">No results in this tier yet.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-plum-muted">
              Save a screening from the New Screening flow and it will appear here instantly.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
