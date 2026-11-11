const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeStudentIdentity(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/[\s-]/g, "");
}

export function isValidThaiPersonId(value: string) {
  const normalized = normalizeStudentIdentity(value);
  if (!/^[0-8]\d{12}$/.test(normalized)) return false;
  const digits = [...normalized].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

export function isValidEducationGCode(value: string) {
  return /^G\d{12}$/.test(normalizeStudentIdentity(value));
}

export function isValidStudentIdentity(value: string) {
  return isValidThaiPersonId(value) || isValidEducationGCode(value);
}

export function studentIdentityError(value: string) {
  const normalized = normalizeStudentIdentity(value);
  if (!normalized) return "กรุณากรอกเลขประจำตัวบุคคลหรือรหัส G";
  if (normalized.startsWith("G")) return "รหัส G ต้องเป็นตัว G ตามด้วยตัวเลข 12 หลัก";
  if (!/^\d{13}$/.test(normalized)) return "เลขประจำตัวบุคคลต้องเป็นตัวเลข 13 หลัก";
  return "เลขประจำตัวบุคคลไม่ผ่านการตรวจสอบ กรุณาตรวจเลขอีกครั้ง";
}
