export async function resolveAdvisorAccountLink(
  db: D1Database,
  username: string,
  existingAdvisorId?: string | null,
) {
  if (existingAdvisorId) {
    const existing = await db.prepare("SELECT id FROM advisors WHERE id=? AND is_active=1")
      .bind(existingAdvisorId).first<{ id: string }>();
    if (existing) return existing.id;
  }
  const matched = await db.prepare(
    "SELECT id FROM advisors WHERE lower(source_username)=lower(?) AND is_active=1 LIMIT 1",
  ).bind(username).first<{ id: string }>();
  return matched?.id ?? null;
}

export function includeAdvisorRole<T extends string>(roles: T[]) {
  return roles.includes("ADVISOR" as T) ? roles : [...roles, "ADVISOR" as T];
}
