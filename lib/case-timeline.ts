const statusLabels: Record<string, string> = {
  NEW: "รับเรื่องแล้ว",
  SCREENING: "เริ่มคัดกรองเคส",
  ASSIGNED: "มอบหมายผู้รับผิดชอบแล้ว",
  IN_PROGRESS: "เริ่มดำเนินการเคส",
  ADMIN_REVIEW: "ส่งผลให้ผู้ดูแลตรวจสอบ",
  DIRECTOR_REVIEW: "เสนอเรื่องให้ผู้อำนวยการพิจารณา",
  DIRECTOR_ORDERED: "ผู้อำนวยการมีคำสั่งให้ดำเนินการ",
  PENDING_CLOSE: "เตรียมปิดเคส",
  RESOLVED: "ดำเนินการเรียบร้อยแล้ว",
  CLOSED: "ปิดเคสแล้ว",
  REOPENED: "เปิดเคสอีกครั้ง",
};

const severityLabels: Record<string, string> = {
  GENERAL: "ทั่วไป",
  CONCERN: "ควรติดตาม",
  SERIOUS: "ร้ายแรง",
  CRITICAL: "เร่งด่วน",
};

function thaiDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function describeCaseUpdate(update: Record<string, unknown>) {
  const lines: string[] = [];
  const status = typeof update.status === "string" ? update.status : "";
  const reason = typeof update.handoffReason === "string" ? update.handoffReason.trim() : "";
  const assignee = typeof update.assignedTo === "string" ? update.assignedTo.trim() : "";
  const severity = typeof update.severity === "string" ? update.severity : "";
  const dueDate = typeof update.dueDate === "string" ? update.dueDate : "";

  if (status) lines.push(statusLabels[status] ?? "เปลี่ยนขั้นตอนการดำเนินงาน");
  if (assignee) lines.push(`มอบหมายให้ ${assignee}`);
  if (severity) lines.push(`ระดับความสำคัญ: ${severityLabels[severity] ?? severity}`);
  if (reason) lines.push(`รายละเอียด: ${reason}`);
  if (dueDate) lines.push(`กำหนดติดตาม: ${thaiDate(dueDate)}`);

  return lines.length ? lines.join("\n") : "บันทึกการเปลี่ยนแปลงข้อมูลเคส";
}

export function humanizeTimelineDescription(description: unknown) {
  if (typeof description !== "string" || !description.trim()) return null;
  const value = description.trim();
  if (!value.startsWith("{") || !value.endsWith("}")) return value;
  try {
    return describeCaseUpdate(JSON.parse(value) as Record<string, unknown>);
  } catch {
    return "บันทึกการเปลี่ยนแปลงข้อมูลเคส";
  }
}

export function timelineTitleForUpdate(update: Record<string, unknown>) {
  if (typeof update.status === "string") return statusLabels[update.status] ?? "อัปเดตขั้นตอนเคส";
  if (typeof update.severity === "string") return "ปรับระดับความสำคัญ";
  if (typeof update.assignedTo === "string") return "มอบหมายผู้รับผิดชอบ";
  return "อัปเดตข้อมูลเคส";
}
