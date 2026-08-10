import { env } from "cloudflare:workers";
import { createId, ensureDatabase } from "../../../db/bootstrap";
import { jsonError, requireStaff } from "../../../lib/security";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const data = await request.formData();
    const file = data.get("file");
    const caseNumber = String(data.get("caseNumber") ?? "").toUpperCase();
    if (!(file instanceof File) || !caseNumber) return jsonError("ข้อมูลไฟล์ไม่ครบถ้วน");
    if (!allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) return jsonError("ชนิดหรือขนาดไฟล์ไม่ถูกต้อง");
    const item = await db.prepare("SELECT id FROM cases WHERE case_number=?").bind(caseNumber).first<{ id: string }>();
    if (!item) return jsonError("ไม่พบเคส", 404);
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
    await requireStaff(request);
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return jsonError("ไม่พบไฟล์", 404);
    const bucket = (env as unknown as { EVIDENCE?: R2Bucket }).EVIDENCE;
    const object = await bucket?.get(key);
    if (!object) return jsonError("ไม่พบไฟล์", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", "attachment");
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("ไม่สามารถดาวน์โหลดไฟล์ได้", 500);
  }
}
