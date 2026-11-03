export const OWNER_REVIEW_USERNAME = "cboonta";

export function isExclusiveReviewPending(item: { status?: unknown; exclusive_reviewer_username?: unknown }) {
  return Boolean(item.exclusive_reviewer_username) && ["NEW", "REOPENED"].includes(String(item.status));
}

export async function findExclusiveReviewerForRoom(db: D1Database, level: string, classroom: string) {
  const reviewer = await db.prepare(`SELECT su.username
    FROM staff_users su
    JOIN advisors a ON (a.id=su.advisor_id OR a.source_username=su.username)
    JOIN advisor_assignments aa ON aa.advisor_id=a.id
    WHERE su.username=? AND su.is_active=1 AND aa.level=? AND aa.classroom=?
    LIMIT 1`).bind(OWNER_REVIEW_USERNAME, level, classroom).first<{ username: string }>();
  return reviewer?.username ?? null;
}
