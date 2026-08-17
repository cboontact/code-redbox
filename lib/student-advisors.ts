import type { AdvisorSummary } from "./types";

type AdvisorRow = Omit<AdvisorSummary, "display_name" | "order"> & {
  level: string;
  classroom: string;
  assignment_order: number;
};

export function advisorRoomKey(level: string, classroom: string) {
  return `${level}|${classroom}`;
}

function toAdvisorSummary(row: AdvisorRow): AdvisorSummary {
  return {
    id: row.id,
    prefix: row.prefix,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: `${row.prefix}${row.first_name} ${row.last_name}`,
    order: Number(row.assignment_order),
  };
}

export async function loadAdvisorMap(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT aa.level,aa.classroom,aa.slot assignment_order,
     a.id,a.prefix,a.first_name,a.last_name
     FROM advisor_assignments aa JOIN advisors a ON a.id=aa.advisor_id
     WHERE a.is_active=1
     ORDER BY aa.level,aa.classroom,aa.slot,a.first_name,a.last_name`,
  ).all<AdvisorRow>();
  const advisorMap = new Map<string, AdvisorSummary[]>();
  for (const row of results) {
    const key = advisorRoomKey(row.level, row.classroom);
    const advisors = advisorMap.get(key) ?? [];
    advisors.push(toAdvisorSummary(row));
    advisorMap.set(key, advisors);
  }
  return advisorMap;
}

export async function loadRoomAdvisors(db: D1Database, level: string, classroom: string) {
  const { results } = await db.prepare(
    `SELECT aa.level,aa.classroom,aa.slot assignment_order,
     a.id,a.prefix,a.first_name,a.last_name
     FROM advisor_assignments aa JOIN advisors a ON a.id=aa.advisor_id
     WHERE a.is_active=1 AND aa.level=? AND aa.classroom=?
     ORDER BY aa.slot,a.first_name,a.last_name`,
  ).bind(level, classroom).all<AdvisorRow>();
  return results.map(toAdvisorSummary);
}

export function attachAdvisorData(
  row: Record<string, unknown>,
  assignedAdvisors: AdvisorSummary[],
): Record<string, unknown> & {
  advisors: AdvisorSummary[];
  advisor_names: string[];
  advisor1: string;
  advisor2: string | null;
} {
  const legacyNames = [row.legacy_advisor1, row.legacy_advisor2]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const advisors = assignedAdvisors.length > 0
    ? assignedAdvisors
    : legacyNames.map((displayName, index) => ({
      id: `legacy-${index + 1}`,
      prefix: "",
      first_name: displayName,
      last_name: "",
      display_name: displayName,
      order: index + 1,
    }));
  const advisorNames = advisors.map((advisor) => advisor.display_name);
  const student = { ...row };
  delete student.legacy_advisor1;
  delete student.legacy_advisor2;
  return {
    ...student,
    advisors,
    advisor_names: advisorNames,
    advisor1: advisorNames[0] ?? "",
    advisor2: advisorNames[1] ?? null,
  };
}
