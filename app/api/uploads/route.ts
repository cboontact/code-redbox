import { env } from "cloudflare:workers";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { jsonError, requireAnyStaff } from "../../../lib/security";
import { hashOpaqueToken, safeTokenEqual } from "../../../lib/opaque-token";
import { sessionHasAnyRole, sessionHasRole } from "../../../lib/admin-auth";
import { isExclusiveReviewPending } from "../../../lib/exclusive-review";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const data = await request.formData();
    const file = data.get("file");
    const caseNumber = String(data.get("caseNumber") ?? "").toUpperCase();
    const uploadToken = String(data.get("uploadToken") ?? "");
    if (!(file instanceof File) || !caseNumber || !uploadToken) return jsonError("ข้อมูลไฟล์ไม่ครบถ้วน");
    if (!allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) return jsonError("ชนิดหรือขนาดไฟล์ไม่ถูกต้อง");
    const item = await db.prepare(`SELECT id,upload_token_hash FROM cases
      WHERE case_number=? AND upload_token_expires_at>CURRENT_TIMESTAMP`)
      .bind(caseNumber).first<{ id: string; upload_token_hash: string | null }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
    const suppliedHash = await hashOpaqueToken(uploadToken);
    if (!item.upload_token_hash || !safeTokenEqual(suppliedHash, item.upload_token_hash)) return jsonError("สิทธิ์อัปโหลดหลักฐานไม่ถูกต้องหรือหมดอายุ", 403);
    const bucket = (env as unknown as { EVIDENCE?: R2Bucket }).EVIDENCE;
    if (!bucket) return jsonError("พื้นที่จัดเก็บไฟล์ยังไม่พร้อมใช้งาน", 503);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const key = `cases/${item.id}/${crypto.randomUUID()}-${safeName}`;
    await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { caseNumber } });
    await db.prepare(
      "INSERT INTO case_attachments (id,case_id,original_name,storage_key,mime_type,file_size) VALUES (?,?,?,?,?,?)",
    ).bind(createId("attachment"), item.id, file.name, key, file.type, file.size).run();
    return Response.json({ success: true });
  } catch {
    return jsonError("ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองอีกครั้ง", 500);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAnyStaff(request);
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const preview = url.searchParams.get("preview") === "1";
    if (!key) return jsonError("ไม่พบไฟล์", 404);
    const db = await ensureDatabase();
    const attachment = await db.prepare(`SELECT ca.storage_key,ca.case_id,c.assigned_to,c.status,c.exclusive_reviewer_username,s.level,s.classroom
      FROM case_attachments ca JOIN cases c ON c.id=ca.case_id JOIN students s ON s.id=c.student_id
      WHERE ca.storage_key=?`).bind(key).first<{ storage_key: string; case_id: string; assigned_to: string | null; status: string; exclusive_reviewer_username: string | null; level: string; classroom: string }>();
    if (!attachment) return jsonError("ไม่พบไฟล์", 404);
    if (isExclusiveReviewPending(attachment) && attachment.exclusive_reviewer_username !== session.username) return jsonError("ไม่พบไฟล์", 404);
    let allowed = sessionHasAnyRole(session, ["SUPER_ADMIN", "INTAKE"]);
    if (attachment.assigned_to === session.username) allowed = true;
    if (sessionHasRole(session, "STUDENT_AFFAIRS") && attachment.status === "AFFAIRS_REVIEW") allowed = true;
    const assignment = await db.prepare("SELECT id FROM case_assignments WHERE case_id=? AND username=? LIMIT 1").bind(attachment.case_id, session.username).first();
    allowed ||= Boolean(assignment);
    if (sessionHasRole(session, "DEPUTY_DIRECTOR") && attachment.status === "DEPUTY_REVIEW") allowed = true;
    if (sessionHasRole(session, "DIRECTOR") && attachment.status === "DIRECTOR_REVIEW") allowed = true;
    if (sessionHasRole(session, "ADVISOR") && session.advisorId) {
      const room = await db.prepare("SELECT id FROM advisor_assignments WHERE advisor_id=? AND level=? AND classroom=?")
        .bind(session.advisorId, attachment.level, attachment.classroom).first();
      allowed ||= Boolean(room);
    }
    if (!allowed) return jsonError("ไม่มีสิทธิ์เปิดไฟล์หลักฐานนี้", 403);
    const bucket = (env as unknown as { EVIDENCE?: R2Bucket }).EVIDENCE;
    const object = await bucket?.get(key);
    if (!object) return jsonError("ไม่พบไฟล์", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", preview ? "inline" : "attachment");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถดาวน์โหลดไฟล์ได้", 500);
  }
}
