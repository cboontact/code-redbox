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

  if (!status && assignee) lines.push(`มอบหมายให้ ${assignee}`);
  if (severity) lines.push(`ระดับความสำคัญ: ${severityLabels[severity] ?? severity}`);
  if (reason) lines.push(`รายละเอียด: ${reason}`);
  if (dueDate) lines.push(`กำหนดติดตาม: ${thaiDate(dueDate)}`);

  return lines.length ? lines.join("\n") : null;
}

export function humanizeTimelineDescription(description: unknown, title?: unknown) {
  if (typeof description !== "string" || !description.trim()) return null;
  const value = description.trim();
  if (!value.startsWith("{") || !value.endsWith("}")) {
    const lines = value.split("\n");
    if (typeof title === "string" && lines[0].trim() === title.trim()) lines.shift();
    const readable = lines.join("\n").trim();
    const initialAssignment = readable.match(/^ยังไม่ได้มอบหมาย → ([^:\n]+)(?:: (.*))?$/s);
    if (initialAssignment) return [`มอบหมายให้ ${initialAssignment[1].trim()}`, initialAssignment[2]?.trim() ? `รายละเอียด: ${initialAssignment[2].trim()}` : ""].filter(Boolean).join("\n");
    return readable || null;
  }
  try {
    return describeCaseUpdate(JSON.parse(value) as Record<string, unknown>);
  } catch {
    return "บันทึกการเปลี่ยนแปลงข้อมูลเคส";
  }
}

export function humanizeTimelineEntry<T extends Record<string, unknown>>(entry: T) {
  const originalTitle = typeof entry.title === "string" ? entry.title : "อัปเดตเคส";
  const description = humanizeTimelineDescription(entry.description, originalTitle);
  const severity = originalTitle === "ปรับระดับความสำคัญ" && description?.match(/^ระดับความสำคัญ:\s*(.+)$/);
  return {
    ...entry,
    title: severity ? `ปรับระดับความสำคัญเป็น ${severity[1]}` : originalTitle,
    description: severity ? null : description,
  };
}

export function timelineTitleForUpdate(update: Record<string, unknown>) {
  if (typeof update.status === "string") return statusLabels[update.status] ?? "อัปเดตขั้นตอนเคส";
  if (typeof update.severity === "string") return "ปรับระดับความสำคัญ";
  if (typeof update.assignedTo === "string") return "มอบหมายผู้รับผิดชอบ";
  return "อัปเดตข้อมูลเคส";
}
