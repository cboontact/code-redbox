import { ensureDatabase } from "../../../db/bootstrap";

export async function GET() {
  try {
    const db = await ensureDatabase();
    const { results } = await db.prepare(
      "SELECT id,name,icon,color FROM case_categories WHERE is_active=1 ORDER BY sort_order,name",
    ).all();
    return Response.json({ categories: results });
  } catch (error) {
    console.error("Category request failed", error);
    return Response.json({ error: "ไม่สามารถโหลดประเภทเรื่องได้" }, { status: 500 });
  }
}
