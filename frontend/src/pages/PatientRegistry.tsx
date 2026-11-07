import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Loader2, Pencil, Plus, Printer, Search } from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { PatientDetail, PatientSummary, PatientUpdate, RiskLevel, Sex } from "@/types";
import { SEX_LABELS, formatDate, initials } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { ReferralPill, RiskPill, ScreeningStatusPill } from "@/components/StatusPill";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;

function EditPatientForm({ patient, onDone }: { patient: PatientDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: patient.name,
    age: String(patient.age),
    sex: patient.sex,
    community: patient.community,
    phone: patient.phone,
  });

  const save = useMutation({
    mutationFn: (body: PatientUpdate) => apiPut<PatientSummary>(`/patients/${patient.id}`, body),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`${p.name}'s details updated`);
      onDone();
    },
    onError: (e) => toast.error("Could not update the patient", { description: String((e as Error).message) }),
  });

  const ageNum = Number(form.age);
  const valid = form.name.trim().length > 0 && form.age !== "" && ageNum >= 0 && ageNum <= 120;

  return (
    <div className="mt-6 grid gap-4 rounded-3xl border border-rose-border bg-mauve-pale/40 p-5" data-testid="edit-patient-form">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Full name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          data-testid="edit-patient-name"
          className="rounded-2xl border-rose-border bg-cream"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Age</Label>
          <Input
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            data-testid="edit-patient-age"
            className="rounded-2xl border-rose-border bg-cream"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Sex</Label>
          <Select value={form.sex} onValueChange={(v: string) => setForm({ ...form, sex: v as Sex })}>
            <SelectTrigger className="w-full rounded-2xl border-rose-border bg-cream" data-testid="edit-patient-sex">
              <SelectValue>{(v: string) => SEX_LABELS[v as Sex] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Community</Label>
        <Input
          value={form.community}
          onChange={(e) => setForm({ ...form, community: e.target.value })}
          data-testid="edit-patient-community"
          className="rounded-2xl border-rose-border bg-cream"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Phone</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          data-testid="edit-patient-phone"
          className="rounded-2xl border-rose-border bg-cream"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDone} className="flex-1 rounded-full" data-testid="edit-patient-cancel">
          Cancel
        </Button>
        <Button
          onClick={() =>
            valid &&
            save.mutate({
              name: form.name.trim(),
              age: ageNum,
              sex: form.sex,
              community: form.community.trim(),
              phone: form.phone.trim(),
            })
          }
          disabled={!valid || save.isPending}
          className="flex-1 rounded-full"
          data-testid="edit-patient-save"
        >
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function PatientSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => apiGet<PatientDetail>(`/patients/${id}`),
  });

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-cream p-8 sm:max-w-lg" data-testid="patient-sheet">
        <SheetTitle className="sr-only">Patient detail</SheetTitle>
        {isPending || !data ? (
          <div className="mt-10 space-y-4">
            <div className="h-20 animate-pulse rounded-3xl bg-mauve-pale/70" />
            <div className="h-40 animate-pulse rounded-3xl bg-mauve-pale/70" />
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-soft to-rose-deep font-heading text-xl italic text-cream">
                {initials(data.name)}
              </span>
              <div>
                <p className="font-heading text-2xl tracking-tight text-plum" data-testid="patient-sheet-name">
                  {data.name}
                </p>
                <p className="mt-1 text-sm text-plum-muted">
                  {data.age} yrs · {SEX_LABELS[data.sex]}
                  {data.community ? ` · ${data.community}` : ""}
                  {data.phone ? ` · ${data.phone}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <ScreeningStatusPill count={data.screening_count} />
              <RiskPill level={data.risk_level} />
              <ReferralPill status={data.referral_status} />
            </div>

            {editing ? (
              <EditPatientForm patient={data} onDone={() => setEditing(false)} />
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="rounded-full"
                  data-testid="patient-sheet-edit"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/patients/${data.id}/print`);
                  }}
                  className="rounded-full"
                  data-testid="patient-sheet-print"
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Printable summary
                </Button>
              </div>
            )}

            <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-dusty">
              Screening history ({data.screenings.length})
            </p>
            {data.screenings.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-mauve-pale/60 p-4 text-sm text-plum-muted">
                No screenings yet — this patient is awaiting their first visit.
              </p>
            ) : (
              <ul className="mt-3 space-y-3" data-testid="patient-sheet-history">
                {data.screenings.map((s) => (
                  <li key={s.id} className="rounded-2xl border border-rose-border bg-mauve-pale/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-plum">{formatDate(s.created_at)}</p>
                      <RiskPill level={s.risk_level} />
                    </div>
                    <p className="mt-2 text-xs text-plum-muted">
                      {s.vitals.systolic && s.vitals.diastolic ? `BP ${s.vitals.systolic}/${s.vitals.diastolic} mmHg` : "BP —"}
                      {s.vitals.glucose ? ` · Glucose ${s.vitals.glucose} mg/dL` : ""}
                      {s.symptoms.length > 0 ? ` · ${s.symptoms.length} symptom${s.symptoms.length > 1 ? "s" : ""}` : ""}
                    </p>
                    {s.notes ? <p className="mt-2 text-xs italic text-plum-muted">“{s.notes}”</p> : null}
                  </li>
                ))}
              </ul>
            )}

            <Button
              onClick={() => {
                onClose();
                navigate(`/new-screening?patient=${data.id}`);
              }}
              className="mt-8 w-full rounded-full"
              data-testid="patient-sheet-start-screening"
            >
              {data.screening_count > 0 ? "Record a follow-up visit" : "Start first screening"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const EMPTY_FORM = { name: "", age: "", sex: "female" as Sex, community: "", phone: "" };

function CreatePatientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      apiPost<PatientSummary>("/patients", {
        name: form.name.trim(),
        age: Number(form.age),
        sex: form.sex,
        community: form.community.trim(),
        phone: form.phone.trim(),
      }),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`${p.name} added to the registry`, { description: "A synthetic demo patient, ready for screening." });
      setForm(EMPTY_FORM);
      onOpenChange(false);
    },
    onError: (e) => toast.error("Could not add the patient", { description: String((e as Error).message) }),
  });

  const valid = form.name.trim().length > 0 && form.age !== "" && Number(form.age) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-rose-border bg-cream sm:max-w-md" data-testid="create-patient-dialog">
        <DialogTitle className="font-heading text-2xl tracking-tight text-plum">Add a demo patient</DialogTitle>
        <p className="text-sm text-plum-muted">
          Creates a synthetic patient in the demo registry — no real person is involved.
        </p>
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Full name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Meera Nair"
              data-testid="create-patient-name"
              className="rounded-2xl border-rose-border bg-cream"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Age</Label>
              <Input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="42"
                data-testid="create-patient-age"
                className="rounded-2xl border-rose-border bg-cream"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Sex</Label>
              <Select value={form.sex} onValueChange={(v: string) => setForm({ ...form, sex: v as Sex })}>
                <SelectTrigger className="w-full rounded-2xl border-rose-border bg-cream" data-testid="create-patient-sex">
                  <SelectValue>{(v: string) => SEX_LABELS[v as Sex] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Community</Label>
            <Input
              value={form.community}
              onChange={(e) => setForm({ ...form, community: e.target.value })}
              placeholder="e.g. Rampur"
              data-testid="create-patient-community"
              className="rounded-2xl border-rose-border bg-cream"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Phone (optional)</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 …"
              data-testid="create-patient-phone"
              className="rounded-2xl border-rose-border bg-cream"
            />
          </div>
        </div>
        <Button
          onClick={() => valid && create.mutate()}
          disabled={!valid || create.isPending}
          className="mt-6 w-full rounded-full"
          data-testid="create-patient-submit"
        >
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          Add patient
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientRegistry() {
  const [search, setSearch] = useState("");
  const [community, setCommunity] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: patients, isPending } = useQuery({
    queryKey: ["patients"],
    queryFn: () => apiGet<PatientSummary[]>("/patients"),
  });

  const communities = useMemo(
    () => Array.from(new Set((patients ?? []).map((p) => p.community).filter(Boolean))).sort(),
    [patients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (patients ?? []).filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.community.toLowerCase().includes(q)) return false;
      if (community !== "all" && p.community !== community) return false;
      if (riskFilter !== "all" && p.risk_level !== riskFilter) return false;
      return true;
    });
  }, [patients, search, community, riskFilter]);

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute left-0 top-24 h-80 w-80 rounded-full bg-blush/80 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Patient registry"
          index="03"
          word="Registry"
          title={
            <>
              Every neighbour, <em className="italic ink-rose">held in view.</em>
            </>
          }
          description="Dossier cards for the demo community — screening status, risk tier and referral journey at a glance."
          actions={
            <Button onClick={() => setCreateOpen(true)} className="rounded-full px-6" data-testid="add-patient-button">
              <Plus className="mr-1 h-4 w-4" />
              Add patient
            </Button>
          }
        />
        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SyntheticDataBanner />
          </div>
        </Reveal>

        {/* Filter ribbon */}
        <Reveal delay={0.24}>
          <div className="mt-8 flex flex-col gap-4 surface-silk rounded-[2rem] border p-5 shadow-rose lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-muted/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or community…"
                data-testid="registry-search-input"
                className="rounded-2xl border-rose-border bg-mauve-pale/40 pl-11"
              />
            </div>
            <Select value={community} onValueChange={(v: string) => setCommunity(v)}>
              <SelectTrigger className="rounded-2xl border-rose-border bg-mauve-pale/40 lg:w-56" data-testid="registry-community-filter">
                <SelectValue>{(v: string) => (v === "all" ? "All communities" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All communities</SelectItem>
                {communities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {(["all", "low", "moderate", "high"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  data-testid={`registry-risk-filter-${r}`}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-medium capitalize transition-all",
                    riskFilter === r
                      ? "border-dusty bg-rose-tint/70 text-rose-ink shadow-rose"
                      : "border-rose-border bg-cream text-plum-muted hover:border-rose-soft",
                  )}
                >
                  {r === "all" ? "All tiers" : r}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Cards */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="registry-grid">
          {isPending
            ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-52 animate-pulse rounded-[2rem] bg-mauve-pale/60" />)
            : filtered.map((p, i) => (
                <Reveal key={p.id} delay={0.04 * (i % 6)} y={18}>
                  <Card
                    onClick={() => setSelectedId(p.id)}
                    className="group h-full cursor-pointer surface-silk border transition-all duration-300 hover:-translate-y-1 hover:shadow-rose-lg"
                    data-testid={`patient-card-${i}`}
                  >
                    <CardContent className="relative flex h-full flex-col overflow-hidden p-6">
                      <span aria-hidden className="text-outline pointer-events-none absolute -bottom-6 right-3 select-none font-heading text-[110px] italic leading-none transition-colors duration-500 group-hover:text-rose-soft/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-soft to-rose-deep font-heading text-lg italic text-cream">
                            {initials(p.name)}
                          </span>
                          <div>
                            <p className="font-heading text-xl tracking-tight text-plum">{p.name}</p>
                            <p className="mt-0.5 text-xs text-plum-muted">
                              {p.age} yrs · {SEX_LABELS[p.sex]}
                              {p.community ? ` · ${p.community}` : ""}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-plum-muted/50 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ScreeningStatusPill count={p.screening_count} />
                        <RiskPill level={p.risk_level} />
                        <ReferralPill status={p.referral_status} />
                      </div>
                      <p className="mt-auto pt-4 text-xs text-plum-muted/80">
                        {p.last_screening_at
                          ? `Last screening ${formatDate(p.last_screening_at)} · ${p.screening_count} record${p.screening_count > 1 ? "s" : ""}`
                          : "No screenings yet"}
                      </p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
        </div>

        {!isPending && filtered.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-rose-soft/70 bg-cream/70 p-12 text-center" data-testid="registry-empty">
            <p className="font-heading text-2xl text-plum">
              {(patients ?? []).length === 0 ? "The registry is empty." : "No one matches those filters."}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-plum-muted">
              {(patients ?? []).length === 0
                ? "Add a synthetic demo patient, or start a screening to create one along the way."
                : "Try a different search, community or risk tier."}
            </p>
            {(patients ?? []).length === 0 ? (
              <Button onClick={() => setCreateOpen(true)} className="mt-6 rounded-full px-8" data-testid="registry-empty-add">
                <Plus className="mr-1 h-4 w-4" />
                Add patient
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className="mt-10 text-xs text-plum-muted/60">
          Looking for a full record?{" "}
          <Link to="/clinical-results" className="font-medium text-rose-ink underline-offset-4 hover:underline">
            Open Clinical Results
          </Link>
        </p>
      </div>

      {selectedId ? <PatientSheet id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      <CreatePatientDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
