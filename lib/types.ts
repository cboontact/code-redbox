export type Severity = "WATCH" | "MODERATE" | "SEVERE" | "CRITICAL";
export type CaseStatus = "NEW" | "AFFAIRS_REVIEW" | "IN_PROGRESS" | "INTAKE_REVIEW" | "DEPUTY_REVIEW" | "DIRECTOR_REVIEW" | "CLOSED" | "REOPENED" | "SCREENING" | "ASSIGNED" | "ADMIN_REVIEW" | "DIRECTOR_ORDERED" | "PENDING_CLOSE" | "RESOLVED";

export interface AdvisorSummary {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  display_name: string;
  order: number;
}

export interface Student {
  id: string;
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  level: string;
  classroom: string;
  number: number;
  advisors: AdvisorSummary[];
  advisor_names: string[];
  advisor1: string;
  advisor2: string | null;
  has_identity_number?: number;
}

export interface CaseRecord {
  id: string;
  case_number: string;
  title: string;
  description: string;
  category_name: string;
  category_id: string;
  severity: Severity;
  status: CaseStatus;
  safety_level: string;
  is_anonymous: number;
  requires_immediate_review: number;
  assigned_to: string | null;
  exclusive_reviewer_username?: string | null;
  due_date?: string | null;
  created_at: string;
  reporter_name?: string;
  student_code?: string;
  level?: string;
  classroom?: string;
}
