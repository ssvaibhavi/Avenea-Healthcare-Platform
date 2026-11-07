import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PatientDetail } from "@/types";
import {
  ACTIVITY_LABELS,
  REFERRAL_LABELS,
  RISK_LABELS,
  SEX_LABELS,
  SYMPTOM_LABELS,
  calcBmi,
  formatDate,
  formatDateOnly,
} from "@/lib/constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One-page printable referral summary for a patient (synthetic demo data). */
export default function PrintSummary() {
  const { id = "" } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => apiGet<PatientDetail>(`/patients/${id}`),
  });

  const latest = data?.screenings[0];
  const bmi = latest ? calcBmi(latest.vitals) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/patients"
          data-testid="print-back-link"
          className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to registry
        </Link>
        <Button onClick={() => window.print()} disabled={!data} className="rounded-full px-6" data-testid="print-button">
          <Printer className="mr-1.5 h-4 w-4" />
          Print summary
        </Button>
      </div>

      <article
        className="rounded-[2rem] border border-rose-border bg-cream p-8 shadow-rose sm:p-12 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        data-testid="print-summary"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rose-border pb-6">
          <div>
            <p className="font-heading text-2xl tracking-tight text-plum">Avenea</p>
            <p className="text-xs text-plum-muted">A beautiful path to better health.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Referral summary</p>
            <p className="mt-1 text-xs text-plum-muted">Generated {formatDate(new Date().toISOString())}</p>
          </div>
        </header>

        {isPending ? (
          <div className="mt-8 space-y-4">
            <div className="h-16 animate-pulse rounded-2xl bg-mauve-pale/70" />
            <div className="h-40 animate-pulse rounded-2xl bg-mauve-pale/70" />
          </div>
        ) : isError || !data ? (
          <p className="mt-8 text-sm text-plum-muted" data-testid="print-error">
            This patient record could not be loaded.
          </p>
        ) : (
          <>
            <section className="mt-8">
              <h1 className="font-heading text-3xl tracking-tight text-plum" data-testid="print-patient-name">
                {data.name}
              </h1>
              <p className="mt-1 text-sm text-plum-muted">
                {data.age} yrs · {SEX_LABELS[data.sex]}
                {data.community ? ` · ${data.community}` : ""}
                {data.phone ? ` · ${data.phone}` : ""}
              </p>
            </section>

            {latest ? (
              <>
                <section className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Latest screening</p>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      {[
                        ["Date", formatDate(latest.created_at)],
                        ["Demo risk tier", `${RISK_LABELS[latest.risk_level]} (score ${latest.risk_score})`],
                        [
                          "Blood pressure",
                          latest.vitals.systolic && latest.vitals.diastolic
                            ? `${latest.vitals.systolic}/${latest.vitals.diastolic} mmHg`
                            : "—",
                        ],
                        ["Pulse", latest.vitals.pulse ? `${latest.vitals.pulse} bpm` : "—"],
                        ["Fasting glucose", latest.vitals.glucose ? `${latest.vitals.glucose} mg/dL` : "—"],
                        ["BMI (demo)", bmi !== null ? String(bmi) : "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-rose-border/50 pb-1.5">
                          <dt className="text-plum-muted">{k}</dt>
                          <dd className="text-right font-medium text-plum">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Referral</p>
                    <dl className="mt-3 space-y-1.5 text-sm" data-testid="print-referral">
                      {[
                        ["Status", REFERRAL_LABELS[latest.referral_status]],
                        ["Coordinator", latest.coordinator || "Unassigned"],
                        ["Due", formatDateOnly(latest.referral_due_date)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-rose-border/50 pb-1.5">
                          <dt className="text-plum-muted">{k}</dt>
                          <dd className="text-right font-medium text-plum">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {latest.referral_note ? (
                      <p className="mt-3 text-sm italic text-plum-muted">“{latest.referral_note}”</p>
                    ) : null}
                  </div>
                </section>

                <section className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Findings</p>
                    {latest.flags.length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-plum">
                        {latest.flags.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-plum-muted">No flags raised.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Symptoms & lifestyle</p>
                    <p className="mt-3 text-sm text-plum">
                      {latest.symptoms.length > 0
                        ? latest.symptoms.map((k) => SYMPTOM_LABELS[k] ?? k).join(", ")
                        : "No symptoms reported"}
                    </p>
                    <p className="mt-2 text-sm text-plum-muted">
                      {[
                        latest.lifestyle.smoker ? "Tobacco use" : null,
                        latest.lifestyle.alcohol ? "Regular alcohol" : null,
                        ACTIVITY_LABELS[latest.lifestyle.activity],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </section>

                {latest.notes ? (
                  <section className="mt-8">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Field notes</p>
                    <p className="mt-3 text-sm italic text-plum-muted">“{latest.notes}”</p>
                  </section>
                ) : null}

                {data.screenings.length > 1 ? (
                  <section className="mt-8">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Visit history</p>
                    <ul className="mt-3 space-y-1 text-sm text-plum-muted" data-testid="print-history">
                      {data.screenings.map((s) => (
                        <li key={s.id} className="flex justify-between gap-4">
                          <span>{formatDate(s.created_at)}</span>
                          <span>
                            {s.vitals.systolic && s.vitals.diastolic ? `BP ${s.vitals.systolic}/${s.vitals.diastolic} · ` : ""}
                            {RISK_LABELS[s.risk_level]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : (
              <p className="mt-8 text-sm text-plum-muted">No screenings recorded yet for this patient.</p>
            )}
          </>
        )}

        <footer className="mt-10 border-t border-rose-border pt-4 text-[11px] leading-relaxed text-plum-muted">
          Synthetic demonstration data. This is not a real patient, and the risk tier comes from a demo heuristic. It is not a
          clinical diagnosis.
        </footer>
      </article>
    </div>
  );
}
