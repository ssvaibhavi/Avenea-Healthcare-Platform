import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "@/lib/recharts";
import { Tooltip } from "@/lib/recharts";
import { apiGet } from "@/lib/api";
import type { AnalyticsSummary, RiskLevel } from "@/types";
import { RISK_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { Reveal } from "@/components/Reveal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#5E8B77",
  moderate: "#DFA3B8",
  high: "#8A4A67",
};

const TOOLTIP_STYLE = {
  borderRadius: "1rem",
  border: "1px solid #E9D4DD",
  background: "#FFF8F6",
  boxShadow: "0 18px 44px -20px rgba(201,137,162,0.45)",
  fontSize: "12px",
  color: "#382B33",
};

function dayLabel(d: string): string {
  try {
    return format(new Date(`${d}T00:00:00`), "d MMM");
  } catch {
    return d;
  }
}

export default function Analytics() {
  const { data, isPending } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary"),
  });

  const metrics = [
    { label: "Screenings completed", value: data ? String(data.totals.screenings) : "—", testid: "metric-screenings" },
    { label: "People in registry", value: data ? String(data.totals.patients) : "—", testid: "metric-patients" },
    { label: "Open referrals", value: data ? String(data.totals.open_referrals) : "—", testid: "metric-referrals" },
    { label: "Average age", value: data ? `${data.avg_age}` : "—", testid: "metric-avg-age" },
  ];

  const pipelineMax = Math.max(1, ...(data?.referral_pipeline.map((p) => p.count) ?? [1]));

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute left-0 top-32 h-80 w-80 rounded-full bg-mauve-pale/80 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics"
          index="07"
          word="Insight"
          title={
            <>
              Numbers, told <em className="italic ink-rose">gently.</em>
            </>
          }
          description="Screening volume, risk tiers and referral flow — every figure drawn from the synthetic demo records."
        />
        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SyntheticDataBanner />
            <p className="text-xs text-plum-muted/70">No real-world outcomes are claimed anywhere on this page.</p>
          </div>
        </Reveal>

        {/* Metric cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="analytics-metrics">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={0.05 * i} y={16}>
              <Card className="surface-silk border" data-testid={m.testid}>
                <CardContent className="relative overflow-hidden p-7">
                  <span aria-hidden className="text-outline pointer-events-none absolute -right-1 -top-5 select-none font-heading text-[96px] italic leading-none">
                    0{i + 1}
                  </span>
                  <p className={cn("relative font-heading text-5xl tracking-tight", isPending ? "animate-pulse text-rose-soft" : "ink-rose")}>
                    {m.value}
                  </p>
                  <p className="mt-2 text-sm text-plum-muted">{m.label}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3" y={18}>
            <Card className="surface-silk h-full border" data-testid="chart-screenings-by-day">
              <CardContent className="p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Screenings — last 14 days</p>
                <h3 className="mt-2 font-heading text-2xl tracking-tight text-plum">A steady rhythm of visits</h3>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.screenings_by_day ?? []} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillRose" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C989A2" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#C989A2" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E9D4DD" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={dayLabel}
                        tick={{ fill: "#6E5A64", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "#6E5A64", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number) => [`${value} screenings`, "Visits"] as [string, string]}
                        labelFormatter={(label: string) => dayLabel(label)}
                      />
                      <Area type="monotone" dataKey="count" stroke="#C989A2" strokeWidth={2.5} fill="url(#fillRose)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal className="lg:col-span-2" delay={0.08} y={18}>
            <Card className="surface-silk h-full border" data-testid="chart-risk-distribution">
              <CardContent className="flex h-full flex-col p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Risk distribution</p>
                <h3 className="mt-2 font-heading text-2xl tracking-tight text-plum">Where visits land</h3>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.risk_distribution ?? []}
                        dataKey="count"
                        nameKey="level"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={4}
                        strokeWidth={0}
                      >
                        {(data?.risk_distribution ?? []).map((entry) => (
                          <Cell key={entry.level} fill={RISK_COLORS[entry.level as RiskLevel] ?? "#DFA3B8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number, name: string) =>
                          [`${value} screenings`, RISK_LABELS[name as RiskLevel] ?? name] as [string, string]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-auto flex flex-wrap gap-4 pt-2" data-testid="risk-legend">
                  {(["low", "moderate", "high"] as const).map((level) => (
                    <span key={level} className="inline-flex items-center gap-2 text-xs text-plum-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
                      {RISK_LABELS[level]}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal className="lg:col-span-3" delay={0.12} y={18}>
            <Card className="surface-silk h-full border" data-testid="chart-top-symptoms">
              <CardContent className="p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Most reported symptoms</p>
                <h3 className="mt-2 font-heading text-2xl tracking-tight text-plum">What the field is hearing</h3>
                <div className="mt-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.top_symptoms ?? []} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="symptom"
                        width={132}
                        tick={{ fill: "#6E5A64", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number) => [`${value} reports`, "Mentions"] as [string, string]}
                        cursor={{ fill: "#F5D6E2", opacity: 0.5 }}
                      />
                      <Bar dataKey="count" fill="#C989A2" radius={[0, 10, 10, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal className="lg:col-span-2" delay={0.16} y={18}>
            <Card className="surface-silk h-full border" data-testid="chart-referral-pipeline">
              <CardContent className="flex h-full flex-col p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Referral pipeline</p>
                <h3 className="mt-2 font-heading text-2xl tracking-tight text-plum">From review to completion</h3>
                <div className="mt-6 flex-1 space-y-6" data-testid="referral-pipeline-bars">
                  {(data?.referral_pipeline ?? []).map((stage) => (
                    <div key={stage.status}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-plum-muted">{stage.status.replace("_", " ")}</span>
                        <span className="font-mono text-xs text-plum">{stage.count}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-mauve-pale">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            stage.status === "pending" ? "bg-dusty" : stage.status === "scheduled" ? "bg-[#C9A279]" : "bg-sage",
                          )}
                          style={{ width: `${(stage.count / pipelineMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs text-plum-muted/70">
                  Open referrals await action on the Care Coordination board.
                </p>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        {!isPending && (data?.totals.screenings ?? 0) === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-rose-soft/70 bg-cream/70 p-12 text-center" data-testid="analytics-empty">
            <p className="font-heading text-2xl text-plum">Nothing to chart yet.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-plum-muted">
              Once a demo screening is saved, these curves begin to breathe.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
