import { format, parseISO } from "date-fns";
import type { ActivityLevel, ReferralStatus, RiskLevel, Sex, Vitals } from "@/types";

export const SYMPTOMS: { key: string; label: string }[] = [
  { key: "fever", label: "Fever" },
  { key: "persistent_cough", label: "Persistent cough" },
  { key: "chest_pain", label: "Chest pain" },
  { key: "breathlessness", label: "Breathlessness" },
  { key: "fatigue", label: "Fatigue" },
  { key: "headache", label: "Headache" },
  { key: "blurred_vision", label: "Blurred vision" },
  { key: "swelling", label: "Swelling" },
  { key: "abdominal_pain", label: "Abdominal pain" },
  { key: "dizziness", label: "Dizziness" },
];

export const SYMPTOM_LABELS: Record<string, string> = Object.fromEntries(
  SYMPTOMS.map((s) => [s.key, s.label]),
);

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
};

export const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  none: "No referral",
  pending: "Pending review",
  scheduled: "Clinic scheduled",
  completed: "Care completed",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: "Mostly sedentary",
  moderate: "Moderately active",
  active: "Physically active",
};

export const SEX_LABELS: Record<Sex, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

/** Formats a plain YYYY-MM-DD date (no timezone involved) as "d MMM yyyy". */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Demo-environment BMI — presented for workflow illustration only. */
export function calcBmi(v: Vitals): number | null {
  if (!v.weight_kg || !v.height_cm) return null;
  const m = v.height_cm / 100;
  return Math.round((v.weight_kg / (m * m)) * 10) / 10;
}
