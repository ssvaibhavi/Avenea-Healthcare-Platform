import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, ClipboardCheck, Clock, Loader2, Route as RouteIcon, UserRound } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import type { AnalyticsSummary, ReferralStatus, ReferralUpdate, Screening } from "@/types";
import { formatDate, formatDateOnly, initials } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { RiskPill } from "@/components/StatusPill";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Column {
  status: Exclude<ReferralStatus, "none">;
  title: string;
  hint: string;
  tint: string;
  icon: typeof RouteIcon;
  next: { status: ReferralStatus; label: string } | null;
}

const COLUMNS: Column[] = [
  {
    status: "pending",
    title: "Pending review",
    hint: "New referrals awaiting a decision",
    tint: "bg-gradient-to-b from-[#F6D3DF] to-[#FBEAF0]",
    icon: RouteIcon,
    next: { status: "scheduled", label: "Schedule clinic" },
  },
  {
    status: "scheduled",
    title: "Clinic scheduled",
    hint: "Appointment & transport arranged",
    tint: "bg-gradient-to-b from-[#F4E1D3] to-[#FBF1EA]",
    icon: CalendarCheck,
    next: { status: "completed", label: "Mark care completed" },
  },
  {
    status: "completed",
    title: "Care completed",
    hint: "Referral journey finished",
    tint: "bg-gradient-to-b from-[#E2EEE7] to-[#F6FAF7]",
    icon: CheckCircle2,
    next: null,
  },
];

export default function CareCoordination() {
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [assignDrafts, setAssignDrafts] = useState<Record<string, { coordinator: string; due: string }>>({});
  const queryClient = useQueryClient();

  const { data: screenings, isPending } = useQuery({
    queryKey: ["screenings"],
    queryFn: () => apiGet<Screening[]>("/screenings"),
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary"),
  });

  const referral = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ReferralUpdate) =>
      apiPatch<Screening>(`/screenings/${id}/referral`, body),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`Referral updated for ${s.patient_name}`);
    },
    onError: (e) => toast.error("Could not update the referral", { description: String((e as Error).message) }),
  });

  const grouped = useMemo(() => {
    const map: Record<string, Screening[]> = { pending: [], scheduled: [], completed: [] };
    for (const s of screenings ?? []) {
      if (s.referral_status !== "none" && map[s.referral_status]) map[s.referral_status].push(s);
    }
    return map;
  }, [screenings]);

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute left-0 top-40 h-80 w-80 rounded-full bg-champagne/70 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Care coordination"
          index="05"
          word="Together"
          title={
            <>
              No one falls through <em className="italic ink-rose">the cracks.</em>
            </>
          }
          description="Every referral from the demo screenings, moving gently from first review to completed care."
        />
        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SyntheticDataBanner />
            <span className="rounded-full border border-rose-border bg-cream px-4 py-2 text-xs text-plum-muted" data-testid="coordination-open-count">
              {analytics ? `${analytics.totals.open_referrals} open referral${analytics.totals.open_referrals === 1 ? "" : "s"}` : "— open referrals"}
            </span>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col, ci) => (
            <Reveal key={col.status} delay={0.06 * ci} y={18}>
              <section
                className={cn("relative isolate flex min-h-[320px] flex-col overflow-hidden rounded-[2.25rem] border border-dusty/25 p-5 shadow-rose", col.tint)}
                data-testid={`coordination-column-${col.status}`}
              >
                <span aria-hidden className="text-outline pointer-events-none absolute -bottom-8 right-4 -z-10 select-none font-heading text-[150px] italic leading-none">
                  {["I", "II", "III"][ci]}
                </span>
                <header className="flex items-center justify-between gap-3 px-2 pt-1">
                  <div>
                    <h2 className="flex items-center gap-2 font-heading text-xl tracking-tight text-plum">
                      <col.icon className="h-4.5 w-4.5 text-rose-deep" />
                      {col.title}
                    </h2>
                    <p className="mt-1 text-xs text-plum-muted">{col.hint}</p>
                  </div>
                  <span
                    className="flex h-8 min-w-8 items-center justify-center rounded-full bg-cream px-2 font-mono text-xs text-rose-ink shadow-rose"
                    data-testid={`coordination-count-${col.status}`}
                  >
                    {grouped[col.status].length}
                  </span>
                </header>

                <div className="mt-4 flex-1 space-y-3" data-testid={`coordination-cards-${col.status}`}>
                  {isPending ? (
                    [0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-3xl bg-cream/80" />)
                  ) : grouped[col.status].length === 0 ? (
                    <p className="rounded-3xl border border-dashed border-rose-soft/60 bg-cream/60 p-6 text-center text-sm text-plum-muted">
                      Nothing here — all caught up.
                    </p>
                  ) : (
                    grouped[col.status].map((s) => (
                      <article
                        key={s.id}
                        className="surface-silk rounded-3xl border p-5 shadow-rose transition-all duration-300 hover:-translate-y-0.5 hover:shadow-rose-lg"
                        data-testid={`referral-card-${s.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-soft to-rose-deep font-heading text-sm italic text-cream">
                              {initials(s.patient_name)}
                            </span>
                            <div>
                              <p className="font-medium text-plum">{s.patient_name}</p>
                              <p className="text-xs text-plum-muted">
                                {s.patient_age} yrs{s.community ? ` · ${s.community}` : ""} · {formatDate(s.created_at)}
                              </p>
                            </div>
                          </div>
                          <RiskPill level={s.risk_level} />
                        </div>

                        {s.vitals.systolic && s.vitals.diastolic ? (
                          <p className="mt-3 font-mono text-xs text-plum-muted">
                            BP {s.vitals.systolic}/{s.vitals.diastolic} mmHg
                          </p>
                        ) : null}

                        {(() => {
                          const overdue =
                            col.status !== "completed" &&
                            Boolean(s.referral_due_date) &&
                            Boolean(analytics?.today) &&
                            (s.referral_due_date as string) < (analytics?.today as string);
                          const draft = assignDrafts[s.id] ?? { coordinator: s.coordinator, due: s.referral_due_date ?? "" };
                          const dirty = draft.coordinator.trim() !== s.coordinator || draft.due !== (s.referral_due_date ?? "");
                          return (
                            <div className="mt-3 space-y-2" data-testid={`referral-assignment-${s.id}`}>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-mauve-pale/70 px-3 py-1 text-plum-muted" data-testid={`referral-coordinator-${s.id}`}>
                                  <UserRound className="h-3 w-3" />
                                  {s.coordinator || "Unassigned"}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                                    overdue ? "bg-[#FCECEF] font-medium text-rose-ink" : "bg-mauve-pale/70 text-plum-muted",
                                  )}
                                  data-testid={`referral-due-${s.id}`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {s.referral_due_date ? `${overdue ? "Overdue · " : "Due "}${formatDateOnly(s.referral_due_date)}` : "No due date"}
                                </span>
                              </div>
                              {col.status !== "completed" ? (
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                  <Input
                                    value={draft.coordinator}
                                    onChange={(e) => setAssignDrafts({ ...assignDrafts, [s.id]: { ...draft, coordinator: e.target.value } })}
                                    placeholder="Assign coordinator"
                                    data-testid={`referral-coordinator-input-${s.id}`}
                                    className="h-9 rounded-2xl border-rose-border bg-mauve-pale/30 text-sm"
                                  />
                                  <Input
                                    type="date"
                                    value={draft.due}
                                    onChange={(e) => setAssignDrafts({ ...assignDrafts, [s.id]: { ...draft, due: e.target.value } })}
                                    data-testid={`referral-due-input-${s.id}`}
                                    className="h-9 w-[150px] rounded-2xl border-rose-border bg-mauve-pale/30 text-sm"
                                  />
                                </div>
                              ) : null}
                              {dirty ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    referral.mutate(
                                      {
                                        id: s.id,
                                        referral_status: s.referral_status,
                                        coordinator: draft.coordinator.trim(),
                                        referral_due_date: draft.due,
                                      },
                                      {
                                        onSuccess: () => {
                                          const next = { ...assignDrafts };
                                          delete next[s.id];
                                          setAssignDrafts(next);
                                        },
                                      },
                                    )
                                  }
                                  disabled={referral.isPending}
                                  data-testid={`referral-assign-save-${s.id}`}
                                  className="w-full rounded-full"
                                >
                                  Save assignment
                                </Button>
                              ) : null}
                            </div>
                          );
                        })()}

                        {s.referral_note ? (
                          <p className="mt-3 rounded-2xl bg-mauve-pale/60 p-3 text-xs italic text-plum-muted">“{s.referral_note}”</p>
                        ) : null}

                        <Textarea
                          value={noteDrafts[s.id] ?? ""}
                          onChange={(e) => setNoteDrafts({ ...noteDrafts, [s.id]: e.target.value })}
                          placeholder="Add a coordination note…"
                          rows={2}
                          data-testid={`referral-note-${s.id}`}
                          className="mt-3 rounded-2xl border-rose-border bg-mauve-pale/30 text-sm"
                        />

                        <div className="mt-3 flex gap-2">
                          {col.next ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                referral.mutate({
                                  id: s.id,
                                  referral_status: col.next!.status,
                                  referral_note: noteDrafts[s.id]?.trim() || undefined,
                                })
                              }
                              disabled={referral.isPending}
                              data-testid={`advance-referral-${s.id}`}
                              className="flex-1 rounded-full"
                            >
                              {referral.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                              {col.next.label}
                            </Button>
                          ) : (
                            <span className="flex flex-1 items-center gap-2 rounded-full bg-sage-soft px-4 py-2 text-xs font-medium text-sage-deep">
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Journey complete
                            </span>
                          )}
                          {noteDrafts[s.id]?.trim() ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                referral.mutate({ id: s.id, referral_status: s.referral_status, referral_note: noteDrafts[s.id].trim() })
                              }
                              disabled={referral.isPending}
                              data-testid={`referral-note-save-${s.id}`}
                              className="rounded-full"
                            >
                              Save note
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-xs text-plum-muted/60">
          Referrals are opened automatically when a demo screening lands in the moderate or high tier.
        </p>
      </div>
    </div>
  );
}
