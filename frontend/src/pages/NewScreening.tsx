import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { ActivityLevel, PatientSummary, Screening, ScreeningCreate, Sex } from "@/types";
import { ACTIVITY_LABELS, SEX_LABELS, SYMPTOMS, calcBmi } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEPS = ["Patient", "Demographics", "Vitals", "Lifestyle", "Review"] as const;
type Mode = "existing" | "new";

interface DemoState {
  name: string;
  age: string;
  sex: Sex;
  community: string;
  phone: string;
}

interface VitalState {
  systolic: string;
  diastolic: string;
  pulse: string;
  weight: string;
  height: string;
  glucose: string;
}

const EMPTY_DEMO: DemoState = { name: "", age: "", sex: "female", community: "", phone: "" };
const EMPTY_VITALS: VitalState = { systolic: "", diastolic: "", pulse: "", weight: "", height: "", glucose: "" };

function toNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  placeholder,
  testid,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testid: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testid}
          className="rounded-2xl border-rose-border bg-cream pr-14"
        />
        {unit ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-plum-muted/70">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  testid,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testid: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className="rounded-2xl border-rose-border bg-cream"
      />
    </div>
  );
}

export default function NewScreening() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("new");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoState>(EMPTY_DEMO);
  const [vitals, setVitals] = useState<VitalState>(EMPTY_VITALS);
  const [lifestyle, setLifestyle] = useState<{ smoker: boolean; alcohol: boolean; activity: ActivityLevel }>({
    smoker: false,
    alcohol: false,
    activity: "moderate",
  });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  const { data: patients, isPending: patientsLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: () => apiGet<PatientSummary[]>("/patients"),
  });

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    return (patients ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.community.toLowerCase().includes(q),
    );
  }, [patients, patientSearch]);

  // Deep link from the registry: /new-screening?patient=<id> preselects that patient.
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("patient");
  const [autoSelected, setAutoSelected] = useState(false);

  useEffect(() => {
    if (!preselectedId || autoSelected || !patients) return;
    const match = patients.find((p) => p.id === preselectedId);
    if (match) {
      setMode("existing");
      setPatientId(match.id);
      setDemo({ name: match.name, age: String(match.age), sex: match.sex, community: match.community, phone: match.phone });
    }
    setAutoSelected(true);
  }, [preselectedId, autoSelected, patients]);

  function choosePatient(p: PatientSummary) {
    if (patientId === p.id) return;
    setPatientId(p.id);
    setDemo({ name: p.name, age: String(p.age), sex: p.sex, community: p.community, phone: p.phone });
  }

  function toggleSymptom(key: string) {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  const ageNum = toNum(demo.age);
  const canProceed = [
    mode === "existing" ? Boolean(patientId) : demo.name.trim().length > 0 && ageNum !== null,
    ageNum !== null,
    toNum(vitals.systolic) !== null && toNum(vitals.diastolic) !== null,
    true,
    true,
  ][step];

  const bmi = calcBmi({
    systolic: toNum(vitals.systolic),
    diastolic: toNum(vitals.diastolic),
    pulse: toNum(vitals.pulse),
    weight_kg: toNum(vitals.weight),
    height_cm: toNum(vitals.height),
    glucose: toNum(vitals.glucose),
  });

  const save = useMutation({
    mutationFn: (payload: ScreeningCreate) => apiPost<Screening>("/screenings", payload),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`Screening saved for ${s.patient_name}`, {
        description: `Demo risk tier: ${s.risk_level}. It is now visible in the Patient Registry.`,
      });
      navigate("/patients");
    },
    onError: (e) =>
      toast.error("Could not save the screening", { description: String((e as Error).message) }),
  });

  function submit() {
    save.mutate({
      patient_id: mode === "existing" ? patientId : null,
      new_patient_name: mode === "new" ? demo.name.trim() : null,
      age: ageNum,
      sex: demo.sex,
      community: demo.community.trim() || null,
      phone: demo.phone.trim() || null,
      vitals: {
        systolic: toNum(vitals.systolic),
        diastolic: toNum(vitals.diastolic),
        pulse: toNum(vitals.pulse),
        weight_kg: toNum(vitals.weight),
        height_cm: toNum(vitals.height),
        glucose: toNum(vitals.glucose),
      },
      lifestyle,
      symptoms,
      notes: notes.trim(),
    });
  }

  const vitalRows = [
    {
      label: "Blood pressure",
      value:
        toNum(vitals.systolic) !== null && toNum(vitals.diastolic) !== null
          ? `${vitals.systolic}/${vitals.diastolic} mmHg`
          : "—",
    },
    { label: "Pulse", value: toNum(vitals.pulse) !== null ? `${vitals.pulse} bpm` : "—" },
    { label: "Fasting glucose", value: toNum(vitals.glucose) !== null ? `${vitals.glucose} mg/dL` : "—" },
    { label: "Weight", value: toNum(vitals.weight) !== null ? `${vitals.weight} kg` : "—" },
    { label: "Height", value: toNum(vitals.height) !== null ? `${vitals.height} cm` : "—" },
    { label: "BMI (demo)", value: bmi !== null ? `${bmi}` : "—" },
  ];

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-rose-tint/60 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="New screening"
          index="02"
          word="Screening"
          title={
            <>
              A calm, guided <em className="italic ink-rose">check-in.</em>
            </>
          }
          description="Five soft steps — from the person in front of you to a saved, trackable record. Everything here is synthetic demo data."
        />
        <Reveal delay={0.2}>
          <div className="mt-6">
            <SyntheticDataBanner />
          </div>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {/* Stepper */}
            <Reveal>
              <ol className="flex items-center" data-testid="screening-step-indicator">
                {STEPS.map((label, i) => (
                  <li key={label} className="flex flex-1 items-center last:flex-none">
                    <button
                      type="button"
                      onClick={() => i < step && setStep(i)}
                      disabled={i > step}
                      data-testid={`screening-step-${i}`}
                      className="flex items-center gap-2 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-all duration-300",
                          i < step
                            ? "border-sage/40 bg-sage-soft text-sage-deep"
                            : i === step
                              ? "border-transparent bg-gradient-to-br from-rose-soft to-rose-deep text-cream shadow-rose"
                              : "border-rose-border bg-cream text-plum-muted/60",
                        )}
                      >
                        {i < step ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "hidden text-xs font-medium tracking-wide sm:block",
                          i === step ? "text-plum" : "text-plum-muted/70",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 ? (
                      <span
                        className={cn(
                          "mx-2 h-px flex-1 transition-colors duration-500",
                          i < step ? "bg-dusty" : "bg-rose-border",
                        )}
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            </Reveal>

            {/* Step card */}
            <Reveal delay={0.08} y={18}>
              <div className="surface-silk relative isolate mt-6 overflow-hidden rounded-[2.25rem] border p-6 sm:p-10">
                <span aria-hidden className="text-outline pointer-events-none absolute -right-2 -top-10 -z-10 select-none font-heading text-[180px] italic leading-none" data-testid="screening-step-numeral">
                  0{step + 1}
                </span>
                {/* Step 1 — Patient */}
                {step === 0 ? (
                  <div data-testid="screening-step-patient">
                    <h2 className="font-heading text-2xl tracking-tight text-plum">Who are we screening?</h2>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMode("existing")}
                        data-testid="tab-existing"
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                          mode === "existing"
                            ? "border-dusty bg-rose-tint/60 text-rose-ink shadow-rose"
                            : "border-rose-border bg-cream text-plum-muted hover:border-rose-soft",
                        )}
                      >
                        Existing patient
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("new");
                          setPatientId(null);
                        }}
                        data-testid="tab-new"
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                          mode === "new"
                            ? "border-dusty bg-rose-tint/60 text-rose-ink shadow-rose"
                            : "border-rose-border bg-cream text-plum-muted hover:border-rose-soft",
                        )}
                      >
                        Create new
                      </button>
                    </div>

                    {mode === "existing" ? (
                      <div className="mt-6">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-muted/60" />
                          <Input
                            value={patientSearch}
                            onChange={(e) => setPatientSearch(e.target.value)}
                            placeholder="Search by name or community…"
                            data-testid="patient-search-input"
                            className="rounded-2xl border-rose-border bg-cream pl-11"
                          />
                        </div>
                        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1" data-testid="patient-option-list">
                          {patientsLoading ? (
                            <div className="space-y-2">
                              {[0, 1, 2].map((i) => (
                                <div key={i} className="h-16 animate-pulse rounded-2xl bg-mauve-pale/70" />
                              ))}
                            </div>
                          ) : filteredPatients.length === 0 ? (
                            <p className="rounded-2xl bg-mauve-pale/60 p-4 text-sm text-plum-muted">
                              No patients found — switch to “Create new” to add a synthetic demo patient.
                            </p>
                          ) : (
                            filteredPatients.map((p, i) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => choosePatient(p)}
                                data-testid={`patient-option-${i}`}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all",
                                  patientId === p.id
                                    ? "border-dusty bg-rose-tint/50 shadow-rose"
                                    : "border-rose-border bg-cream hover:border-rose-soft",
                                )}
                              >
                                <div>
                                  <p className="font-medium text-plum">{p.name}</p>
                                  <p className="mt-0.5 text-xs text-plum-muted">
                                    {p.age} yrs · {SEX_LABELS[p.sex]}
                                    {p.community ? ` · ${p.community}` : ""}
                                  </p>
                                </div>
                                {patientId === p.id ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dusty text-cream">
                                    <Check className="h-4 w-4" />
                                  </span>
                                ) : null}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="Full name"
                          value={demo.name}
                          onChange={(v) => setDemo({ ...demo, name: v })}
                          placeholder="e.g. Meera Nair"
                          testid="input-patient-name"
                        />
                        <TextField
                          label="Age (years)"
                          value={demo.age}
                          onChange={(v) => setDemo({ ...demo, age: v })}
                          placeholder="e.g. 42"
                          type="number"
                          testid="input-patient-age"
                        />
                        <p className="text-xs leading-relaxed text-plum-muted sm:col-span-2">
                          A synthetic demo patient will be created along with the screening — no real
                          person is involved.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Step 2 — Demographics */}
                {step === 1 ? (
                  <div data-testid="screening-step-demographics">
                    <h2 className="font-heading text-2xl tracking-tight text-plum">Demographics & community</h2>
                    <p className="mt-2 text-sm text-plum-muted">
                      {mode === "existing"
                        ? "Confirm or refine what the registry holds — saving updates the patient record."
                        : "Tell us a little more about this new demo patient."}
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Age (years)"
                        value={demo.age}
                        onChange={(v) => setDemo({ ...demo, age: v })}
                        placeholder="e.g. 42"
                        type="number"
                        testid="input-demographics-age"
                      />
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">Sex</Label>
                        <Select value={demo.sex} onValueChange={(v: string) => setDemo({ ...demo, sex: v as Sex })}>
                          <SelectTrigger
                            className="w-full rounded-2xl border-rose-border bg-cream"
                            data-testid="select-demographics-sex"
                          >
                            <SelectValue>{(v: string) => SEX_LABELS[v as Sex] ?? v}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <TextField
                        label="Community / village"
                        value={demo.community}
                        onChange={(v) => setDemo({ ...demo, community: v })}
                        placeholder="e.g. Rampur"
                        testid="input-demographics-community"
                      />
                      <TextField
                        label="Phone (optional)"
                        value={demo.phone}
                        onChange={(v) => setDemo({ ...demo, phone: v })}
                        placeholder="+91 …"
                        testid="input-demographics-phone"
                      />
                    </div>
                  </div>
                ) : null}

                {/* Step 3 — Vitals */}
                {step === 2 ? (
                  <div data-testid="screening-step-vitals">
                    <h2 className="font-heading text-2xl tracking-tight text-plum">Vitals & biometrics</h2>
                    <p className="mt-2 text-sm text-plum-muted">
                      Blood pressure is required — it anchors the demo risk tier. Everything else is optional.
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <NumberField
                        label="Systolic BP"
                        unit="mmHg"
                        value={vitals.systolic}
                        onChange={(v) => setVitals({ ...vitals, systolic: v })}
                        placeholder="120"
                        testid="input-vitals-systolic"
                      />
                      <NumberField
                        label="Diastolic BP"
                        unit="mmHg"
                        value={vitals.diastolic}
                        onChange={(v) => setVitals({ ...vitals, diastolic: v })}
                        placeholder="80"
                        testid="input-vitals-diastolic"
                      />
                      <NumberField
                        label="Pulse"
                        unit="bpm"
                        value={vitals.pulse}
                        onChange={(v) => setVitals({ ...vitals, pulse: v })}
                        placeholder="76"
                        testid="input-vitals-pulse"
                      />
                      <NumberField
                        label="Weight"
                        unit="kg"
                        value={vitals.weight}
                        onChange={(v) => setVitals({ ...vitals, weight: v })}
                        placeholder="58"
                        testid="input-vitals-weight"
                      />
                      <NumberField
                        label="Height"
                        unit="cm"
                        value={vitals.height}
                        onChange={(v) => setVitals({ ...vitals, height: v })}
                        placeholder="158"
                        testid="input-vitals-height"
                      />
                      <NumberField
                        label="Fasting glucose"
                        unit="mg/dL"
                        value={vitals.glucose}
                        onChange={(v) => setVitals({ ...vitals, glucose: v })}
                        placeholder="95"
                        testid="input-vitals-glucose"
                      />
                    </div>
                  </div>
                ) : null}

                {/* Step 4 — Lifestyle & symptoms */}
                {step === 3 ? (
                  <div data-testid="screening-step-lifestyle">
                    <h2 className="font-heading text-2xl tracking-tight text-plum">Lifestyle & quick checks</h2>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {(["smoker", "alcohol"] as const).map((key) => (
                        <label
                          key={key}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition-all",
                            lifestyle[key]
                              ? "border-dusty bg-rose-tint/50 shadow-rose"
                              : "border-rose-border bg-cream",
                          )}
                          data-testid={`checkbox-lifestyle-${key}`}
                        >
                          <span className="text-sm font-medium text-plum">
                            {key === "smoker" ? "Uses tobacco" : "Drinks alcohol regularly"}
                          </span>
                          <Checkbox
                            checked={lifestyle[key]}
                            onCheckedChange={(checked: boolean) => setLifestyle({ ...lifestyle, [key]: checked === true })}
                            data-testid={`input-lifestyle-${key}`}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-6">
                      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">
                        Daily activity
                      </Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {(["low", "moderate", "active"] as const).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setLifestyle({ ...lifestyle, activity: a })}
                            data-testid={`activity-option-${a}`}
                            className={cn(
                              "rounded-2xl border px-4 py-3 text-sm transition-all",
                              lifestyle.activity === a
                                ? "border-dusty bg-rose-tint/60 font-medium text-rose-ink shadow-rose"
                                : "border-rose-border bg-cream text-plum-muted hover:border-rose-soft",
                            )}
                          >
                            {ACTIVITY_LABELS[a]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6">
                      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">
                        Symptoms noticed
                      </Label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SYMPTOMS.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => toggleSymptom(s.key)}
                            data-testid={`toggle-symptom-${s.key}`}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all",
                              symptoms.includes(s.key)
                                ? "border-dusty bg-rose-tint/70 font-medium text-plum shadow-rose"
                                : "border-rose-border bg-cream text-plum-muted hover:border-rose-soft",
                            )}
                          >
                            {symptoms.includes(s.key) ? <Check className="h-3.5 w-3.5 text-rose-deep" /> : null}
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6">
                      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-plum-muted">
                        Field notes (optional)
                      </Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anything the care team should know…"
                        rows={3}
                        data-testid="input-screening-notes"
                        className="mt-2 rounded-2xl border-rose-border bg-cream"
                      />
                    </div>
                  </div>
                ) : null}

                {/* Step 5 — Review & save */}
                {step === 4 ? (
                  <div data-testid="screening-step-review">
                    <h2 className="font-heading text-2xl tracking-tight text-plum">Review & save</h2>
                    <p className="mt-2 text-sm text-plum-muted">
                      On save, the demo risk tier is computed and — for moderate or high findings — a
                      referral is opened on the care board.
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-rose-border bg-mauve-pale/50 p-5" data-testid="review-patient">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Patient</p>
                        <p className="mt-2 font-heading text-xl text-plum">
                          {mode === "new" ? `${demo.name} (new)` : demo.name}
                        </p>
                        <p className="mt-1 text-sm text-plum-muted">
                          {demo.age} yrs · {SEX_LABELS[demo.sex]}
                          {demo.community ? ` · ${demo.community}` : ""}
                          {demo.phone ? ` · ${demo.phone}` : ""}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-border bg-mauve-pale/50 p-5" data-testid="review-vitals">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Vitals</p>
                        <dl className="mt-2 space-y-1 text-sm text-plum-muted">
                          {vitalRows.map((row) => (
                            <div key={row.label} className="flex justify-between gap-4">
                              <dt>{row.label}</dt>
                              <dd className="font-medium text-plum">{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="rounded-2xl border border-rose-border bg-mauve-pale/50 p-5" data-testid="review-lifestyle">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Lifestyle</p>
                        <p className="mt-2 text-sm text-plum-muted">
                          {lifestyle.smoker ? "Tobacco use · " : ""}
                          {lifestyle.alcohol ? "Regular alcohol · " : ""}
                          {ACTIVITY_LABELS[lifestyle.activity]}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-border bg-mauve-pale/50 p-5" data-testid="review-symptoms">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-dusty">Symptoms</p>
                        <p className="mt-2 text-sm text-plum-muted">
                          {symptoms.length > 0
                            ? SYMPTOMS.filter((s) => symptoms.includes(s.key))
                                .map((s) => s.label)
                                .join(", ")
                            : "None reported"}
                        </p>
                        {notes.trim() ? (
                          <p className="mt-3 border-t border-rose-border/60 pt-3 text-sm italic text-plum-muted">
                            “{notes.trim()}”
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Navigation */}
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-rose-border/60 pt-6">
                  {step > 0 ? (
                    <Button
                      variant="ghost"
                      onClick={() => setStep(step - 1)}
                      data-testid="button-screening-back"
                      className="rounded-full"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS.length - 1 ? (
                    <Button
                      onClick={() => canProceed && setStep(step + 1)}
                      disabled={!canProceed}
                      data-testid="button-screening-next"
                      className="rounded-full px-8"
                    >
                      Continue
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={submit}
                      disabled={save.isPending}
                      data-testid="button-save-screening"
                      className="rounded-full px-8"
                    >
                      {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                      Save screening
                    </Button>
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Side rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 surface-silk rounded-[2rem] border p-6 shadow-rose">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-dusty">Session</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4" data-testid="session-patient">
                  <dt className="text-plum-muted">Patient</dt>
                  <dd className="max-w-[55%] text-right font-medium text-plum">
                    {mode === "existing" ? (patientId ? demo.name : "—") : demo.name || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4" data-testid="session-bp">
                  <dt className="text-plum-muted">Blood pressure</dt>
                  <dd className="font-medium text-plum">
                    {vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4" data-testid="session-symptoms">
                  <dt className="text-plum-muted">Symptoms</dt>
                  <dd className="font-medium text-plum">{symptoms.length}</dd>
                </div>
              </dl>
              <div className="mt-6 rounded-2xl bg-mauve-pale/60 p-4 text-xs leading-relaxed text-plum-muted">
                Saving records a synthetic demo screening. The risk tier comes from a transparent demo
                heuristic — it is not a diagnosis.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
