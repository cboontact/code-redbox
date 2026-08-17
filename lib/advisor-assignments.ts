import { z } from "zod";

const roomAssignmentSchema = z.object({
  level: z.string().trim().min(1).max(20),
  classroom: z.string().trim().min(1).max(20),
});

export const advisorAssignmentsSchema = z.array(roomAssignmentSchema).max(100).superRefine((assignments, context) => {
  const seen = new Set<string>();
  assignments.forEach((assignment, index) => {
    const key = roomKey(assignment.level, assignment.classroom);
    if (seen.has(key)) {
      context.addIssue({
        code: "custom",
        message: "ไม่สามารถกำหนดห้องเดิมซ้ำให้ครูคนเดียวกันได้",
        path: [index],
      });
    }
    seen.add(key);
  });
});

export type AdvisorAssignmentInput = z.infer<typeof roomAssignmentSchema>;

export function roomKey(level: string, classroom: string) {
  return `${level}|${classroom}`;
}

export async function assignmentsUseKnownRooms(db: D1Database, assignments: AdvisorAssignmentInput[]) {
  if (assignments.length === 0) return true;
  const { results } = await db.prepare(
    "SELECT level,classroom FROM students WHERE is_active=1 GROUP BY level,classroom",
  ).all<{ level: string; classroom: string }>();
  const knownRooms = new Set(results.map((room) => roomKey(room.level, room.classroom)));
  return assignments.every((assignment) => knownRooms.has(roomKey(assignment.level, assignment.classroom)));
}

export function prepareAdvisorAssignmentInsert(
  db: D1Database,
  id: string,
  advisorId: string,
  assignment: AdvisorAssignmentInput,
) {
  return db.prepare(
    `INSERT INTO advisor_assignments (id,advisor_id,level,classroom,slot)
     SELECT ?,?,?,?,COALESCE(MAX(slot),0)+1
     FROM advisor_assignments WHERE level=? AND classroom=?`,
  ).bind(id, advisorId, assignment.level, assignment.classroom, assignment.level, assignment.classroom);
}
