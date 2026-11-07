// Hand-written mirrors of the Pydantic models in backend/models/ — nothing infers
// across the HTTP boundary, so these are the source of truth on the TS side.

export type Sex = "female" | "male" | "other";
export type RiskLevel = "low" | "moderate" | "high";
export type ReferralStatus = "none" | "pending" | "scheduled" | "completed";
export type ActivityLevel = "low" | "moderate" | "active";

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  community: string;
  phone: string;
  created_at: string;
  seeded_demo?: boolean;
}

export interface PatientSummary extends Patient {
  screening_count: number;
  last_screening_at: string | null;
  risk_level: RiskLevel | null;
  referral_status: ReferralStatus | null;
}

export interface Screening {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: Sex;
  community: string;
  vitals: Vitals;
  lifestyle: Lifestyle;
  symptoms: string[];
  notes: string;
  flags: string[];
  risk_score: number;
  risk_level: RiskLevel;
  referral_status: ReferralStatus;
  referral_note: string;
  coordinator: string;
  referral_due_date: string | null;
  created_at: string;
  seeded_demo?: boolean;
}

export interface Vitals {
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  glucose: number | null;
}

export interface Lifestyle {
  smoker: boolean;
  alcohol: boolean;
  activity: ActivityLevel;
}

export interface ScreeningCreate {
  patient_id?: string | null;
  new_patient_name?: string | null;
  age?: number | null;
  sex?: Sex | null;
  community?: string | null;
  phone?: string | null;
  vitals: Vitals;
  lifestyle: Lifestyle;
  symptoms: string[];
  notes: string;
}

export interface ReferralUpdate {
  referral_status: ReferralStatus;
  referral_note?: string;
  coordinator?: string;
  referral_due_date?: string;
}

export interface PatientUpdate {
  name?: string;
  age?: number;
  sex?: Sex;
  community?: string;
  phone?: string;
}

export interface PatientDetail extends PatientSummary {
  screenings: Screening[];
}

export interface Totals {
  patients: number;
  screenings: number;
  open_referrals: number;
  communities: number;
}

export interface LevelCount {
  level: string;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface SymptomCount {
  symptom: string;
  count: number;
}

export interface AnalyticsSummary {
  totals: Totals;
  risk_distribution: LevelCount[];
  referral_pipeline: StatusCount[];
  screenings_by_day: DayCount[];
  top_symptoms: SymptomCount[];
  avg_age: number;
  today: string;
  demo: boolean;
}

export interface PublicStats {
  totals: Totals;
  demo: boolean;
}
