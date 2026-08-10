export type Severity = "GENERAL" | "CONCERN" | "SERIOUS" | "CRITICAL";
export type CaseStatus = "NEW" | "SCREENING" | "IN_PROGRESS" | "DIRECTOR_REVIEW" | "RESOLVED" | "CLOSED";

export interface Student {
  id: string;
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  level: string;
  classroom: string;
  number: number;
  advisor1: string;
  advisor2: string | null;
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
  created_at: string;
  reporter_name?: string;
  student_code?: string;
}
