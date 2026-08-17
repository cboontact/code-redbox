import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleInfo,
  faClock,
  faFolderOpen,
  faGavel,
  faMagnifyingGlass,
  faShieldHalved,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const severityIcons: Record<string, IconDefinition> = {
  GENERAL: faCircleInfo,
  CONCERN: faClock,
  SERIOUS: faShieldHalved,
  CRITICAL: faTriangleExclamation,
};

const statusIcons: Record<string, IconDefinition> = {
  NEW: faFolderOpen,
  SCREENING: faMagnifyingGlass,
  ASSIGNED: faFolderOpen,
  IN_PROGRESS: faClock,
  ADMIN_REVIEW: faMagnifyingGlass,
  DIRECTOR_REVIEW: faGavel,
  DIRECTOR_ORDERED: faGavel,
  PENDING_CLOSE: faClock,
  RESOLVED: faCheckCircle,
  CLOSED: faCheckCircle,
  REOPENED: faFolderOpen,
};

export const severityLabels: Record<string, string> = {
  GENERAL: "ทั่วไป",
  CONCERN: "ควรติดตาม",
  SERIOUS: "ร้ายแรง",
  CRITICAL: "เร่งด่วน",
};

export const statusLabels: Record<string, string> = {
  NEW: "รับเรื่องแล้ว",
  SCREENING: "กำลังคัดกรอง",
  ASSIGNED: "มอบหมายแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  ADMIN_REVIEW: "รอเจ้าหน้าที่ตรวจผล",
  DIRECTOR_REVIEW: "เสนอผู้อำนวยการ",
  DIRECTOR_ORDERED: "ผู้อำนวยการสั่งการ",
  PENDING_CLOSE: "รอตรวจสอบก่อนปิด",
  RESOLVED: "ดำเนินการเรียบร้อย",
  CLOSED: "ปิดเรื่อง",
  REOPENED: "เปิดเรื่องใหม่",
};

export function SeverityBadge({ value }: { value: string }) {
  return <span className={`badge severity-${value}`}><FontAwesomeIcon icon={severityIcons[value] ?? faCircleInfo} />{severityLabels[value] ?? value}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge status-${value}`}><FontAwesomeIcon icon={statusIcons[value] ?? faCircleInfo} />{statusLabels[value] ?? value}</span>;
}
