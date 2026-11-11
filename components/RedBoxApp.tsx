"use client";
/* eslint-disable @next/next/no-img-element -- Static school branding and local evidence previews avoid external image optimization. */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faBell,
  faBookOpen,
  faBoxOpen,
  faChartLine,
  faCheck,
  faCheckCircle,
  faChevronRight,
  faCircleInfo,
  faClock,
  faCode,
  faCopyright,
  faAlignLeft,
  faCopy,
  faDatabase,
  faFileArrowUp,
  faFolderOpen,
  faHeading,
  faHeart,
  faLightbulb,
  faLock,
  faLocationDot,
  faMagnifyingGlass,
  faMessage,
  faPaperPlane,
  faPen,
  faPeopleGroup,
  faPlus,
  faRotate,
  faSchool,
  faShieldHalved,
  faSliders,
  faTrashCan,
  faTriangleExclamation,
  faUserGraduate,
  faUserShield,
  faXmark,
  faComments,
  faDiagramProject,
  faEnvelopeOpenText,
  faEyeSlash,
  faFlagCheckered,
  faHand,
  faHandHoldingHeart,
  faHeartPulse,
  faInbox,
  faPenToSquare,
  faPhone,
  faRoute,
  faShareNodes,
  faShieldHeart,
  faStar,
  faUser,
  faUserSecret,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { SiCloudflare, SiNextdotjs, SiTypescript } from "react-icons/si";
import type { CaseRecord, CaseStatus, Student } from "../lib/types";
import { SeverityBadge, StatusBadge } from "./CaseBadge";
import { EvidencePreview } from "./EvidencePreview";
import { WorkflowTransitionModal } from "./WorkflowTransitionModal";
import { isValidStudentIdentity, normalizeStudentIdentity, studentIdentityError } from "../lib/student-identity";

type AppView = "home" | "report" | "track" | "admin";
type Category = { id: string; name: string; icon: string; color: string };
type Attachment = {
  id: string;
  original_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
};
type Detail = {
  case: CaseRecord & Record<string, unknown> & { advisor_names?: string[] };
  timeline: Timeline[];
  notes: Note[];
  attachments: Attachment[];
  assignments: Array<{ id: string; username: string; display_name: string; assignment_role: "LEAD" | "MEMBER"; status: string; role_values?: string }>;
};
type Timeline = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
};
type Note = {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  is_editable: number;
};

const categoryIcons = [
  faUserShield,
  faHeartPulse,
  faHand,
  faTriangleExclamation,
  faBookOpen,
  faSchool,
  faLightbulb,
  faMessage,
];
const categoryFallbacks = [
  { id: "bullying", name: "การกลั่นแกล้ง", color: "cyan" },
  { id: "mental", name: "ความเครียด / สุขภาพใจ", color: "green" },
  { id: "violence", name: "ความรุนแรง / คุกคาม", color: "red" },
  { id: "safety", name: "ความปลอดภัย", color: "amber" },
  { id: "study", name: "การเรียน", color: "blue" },
  { id: "facility", name: "อาคาร / สถานที่", color: "orange" },
  { id: "suggestion", name: "ข้อเสนอแนะ", color: "green" },
  { id: "other", name: "อื่น ๆ", color: "slate" },
];

const helpOptions = [
  { label: "รับทราบ", icon: faCheckCircle },
  { label: "ขอคำปรึกษา", icon: faHeart },
  { label: "ช่วยพูดคุย", icon: faMessage },
  { label: "ช่วยไกล่เกลี่ย", icon: faPeopleGroup },
  { label: "ตรวจสอบ", icon: faMagnifyingGlass },
  { label: "หยุดเหตุการณ์", icon: faShieldHalved },
  { label: "ช่วยเหลือเร่งด่วน", icon: faTriangleExclamation },
  { label: "อื่น ๆ", icon: faCircleInfo },
] as const;

const statusLabels: Record<string, string> = {
  NEW: "รับเรื่องแล้ว",
  AFFAIRS_REVIEW: "รอทีมกิจการนักเรียน",
  REOPENED: "เปิดเรื่องใหม่",
  SCREENING: "กำลังคัดกรอง",
  ASSIGNED: "มอบหมายแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  INTAKE_REVIEW: "รอเจ้าหน้าที่ตรวจผล",
  DEPUTY_REVIEW: "รอรองผู้อำนวยการ",
  ADMIN_REVIEW: "รอเจ้าหน้าที่ตรวจผล",
  DIRECTOR_REVIEW: "เสนอผู้อำนวยการ",
  DIRECTOR_ORDERED: "ผู้อำนวยการสั่งการ",
  PENDING_CLOSE: "รอตรวจสอบก่อนปิด",
  RESOLVED: "ดำเนินการเรียบร้อย",
  CLOSED: "ปิดเรื่อง",
};
const statusGroups: Array<{ key: string; label: string; statuses: readonly CaseStatus[] }> = [
  { key: "pending", label: "รอพิจารณาและมอบหมาย", statuses: ["NEW", "REOPENED", "AFFAIRS_REVIEW", "DEPUTY_REVIEW", "SCREENING", "ASSIGNED"] },
  { key: "active", label: "กำลังดำเนินการและตรวจผล", statuses: ["IN_PROGRESS", "INTAKE_REVIEW", "ADMIN_REVIEW", "DIRECTOR_REVIEW", "DIRECTOR_ORDERED", "PENDING_CLOSE"] },
  { key: "completed", label: "เสร็จสิ้น", statuses: ["RESOLVED", "CLOSED"] },
];
const dashboardStatusFilters = {
  new: ["NEW", "REOPENED"],
  pending: ["AFFAIRS_REVIEW", "DEPUTY_REVIEW", "SCREENING", "ASSIGNED"],
  active: ["IN_PROGRESS", "DIRECTOR_ORDERED"],
  review: ["INTAKE_REVIEW", "ADMIN_REVIEW", "DIRECTOR_REVIEW", "PENDING_CLOSE"],
  closed: ["RESOLVED", "CLOSED"],
} as const satisfies Record<string, readonly CaseStatus[]>;
type DashboardStatusFilter = keyof typeof dashboardStatusFilters;
function matchesDashboardStatus(filter: DashboardStatusFilter, status: CaseStatus) {
  return (dashboardStatusFilters[filter] as readonly CaseStatus[]).includes(status);
}
const severityLabels: Record<string, string> = {
  WATCH: "เฝ้าระวัง",
  MODERATE: "เสี่ยงปานกลาง",
  SEVERE: "รุนแรง",
  CRITICAL: "วิกฤต",
};

function availableStatusEntries(
  current: string,
  assignedRoles: string | string[],
  assignedToCase = false,
  isLeadAssignee = false,
) {
  const edges: Record<string, string[]> = {
    NEW: ["AFFAIRS_REVIEW", "DEPUTY_REVIEW", "CLOSED"],
    AFFAIRS_REVIEW: ["IN_PROGRESS", "INTAKE_REVIEW"],
    SCREENING: ["ASSIGNED"],
    ASSIGNED: ["IN_PROGRESS"],
    IN_PROGRESS: ["INTAKE_REVIEW"],
    INTAKE_REVIEW: ["IN_PROGRESS", "CLOSED"],
    ADMIN_REVIEW: ["DIRECTOR_REVIEW", "CLOSED"],
    DIRECTOR_ORDERED: ["IN_PROGRESS"],
    PENDING_CLOSE: ["CLOSED"],
    RESOLVED: ["CLOSED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["AFFAIRS_REVIEW", "DEPUTY_REVIEW", "CLOSED"],
  };
  const roleEdges: Record<string, string[]> = {
    INTAKE: [
      "NEW>AFFAIRS_REVIEW", "NEW>DEPUTY_REVIEW", "NEW>CLOSED",
      "REOPENED>AFFAIRS_REVIEW", "REOPENED>DEPUTY_REVIEW", "REOPENED>CLOSED",
      "INTAKE_REVIEW>IN_PROGRESS", "INTAKE_REVIEW>CLOSED",
      "SCREENING>ASSIGNED",
      "ASSIGNED>IN_PROGRESS",
      "ADMIN_REVIEW>DIRECTOR_REVIEW",
      "ADMIN_REVIEW>CLOSED",
      "PENDING_CLOSE>CLOSED",
      "RESOLVED>CLOSED",
    ],
    STUDENT_AFFAIRS: ["AFFAIRS_REVIEW>IN_PROGRESS", "AFFAIRS_REVIEW>INTAKE_REVIEW"],
  };
  const assignmentEdges = new Set(["ASSIGNED>IN_PROGRESS", "DIRECTOR_ORDERED>IN_PROGRESS"]);
  const rolesForAccount = Array.isArray(assignedRoles) ? assignedRoles : [assignedRoles];
  const next = (edges[current] ?? []).filter((status) => {
    const edge = `${current}>${status}`;
    return rolesForAccount.includes("SUPER_ADMIN")
      || rolesForAccount.some((role) => roleEdges[role]?.includes(edge))
      || (assignedToCase && assignmentEdges.has(edge))
      || (isLeadAssignee && edge === "IN_PROGRESS>INTAKE_REVIEW");
  });
  return [current, ...next].map(
    (status) => [status, statusLabels[status] ?? status] as const,
  );
}

function CaseWorkflowProgress({ status }: { status: string }) {
  const steps = ["รับเรื่อง", "กิจการ/ฝ่ายบริหาร", "ครูดำเนินการ", "เจ้าหน้าที่ตรวจผล", "ปิดเคส"];
  const stageByStatus: Record<string, number> = {
    NEW: 0,
    AFFAIRS_REVIEW: 1,
    DEPUTY_REVIEW: 1,
    SCREENING: 1,
    REOPENED: 1,
    ASSIGNED: 2,
    IN_PROGRESS: 2,
    INTAKE_REVIEW: 3,
    DIRECTOR_ORDERED: 2,
    ADMIN_REVIEW: 3,
    DIRECTOR_REVIEW: 3,
    PENDING_CLOSE: 3,
    RESOLVED: 3,
    CLOSED: 4,
  };
  const currentStage = stageByStatus[status] ?? 0;
  return (
    <div className="case-workflow-progress" aria-label="ลำดับการดำเนินงานของเคส">
      {steps.map((label, index) => (
        <div
          key={label}
          className={
            index < currentStage
              ? "complete"
              : index === currentStage
                ? "current"
                : "upcoming"
          }
        >
          <span>{index < currentStage ? <FontAwesomeIcon icon={faCheck} /> : index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function RedBoxApp({ view }: { view: AppView }) {
  const [toast, setToast] = useState<string | null>(null);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };
  return (
    <div className="app-shell">
      {view !== "admin" && <PublicHeader />}
      {view === "home" && <HomeContent />}
      {view === "report" && <ReportWizard notify={notify} />}
      {view === "track" && <Tracking notify={notify} />}
      {view === "admin" && <AdminDashboard notify={notify} />}
      {view === "admin" && <AdminQuickActions />}
      {view !== "admin" && <PublicFooter />}
      {toast && (
        <div className="toast" role="status">
          <FontAwesomeIcon icon={faCheckCircle} /> {toast}
        </div>
      )}
    </div>
  );
}

function AdminQuickActions() {
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <button
      type="button"
      className="admin-logout"
      onClick={logout}
      aria-label="ออกจากระบบ"
      title="ออกจากระบบ"
    >
      <FontAwesomeIcon icon={faArrowRight} />
    </button>
  );
}

function Ic({ icon, className }: { icon: IconDefinition; className?: string }) {
  return (
    <i className={className}>
      <FontAwesomeIcon icon={icon} />
    </i>
  );
}

function PublicHeader() {
  return (
    <header className="rb-header">
      <Link href="/" className="rb-brand" aria-label="กล่องแดง หน้าแรก">
        <img
          className="school-logo"
          src="/images/chomthong-logo.png"
          width={44}
          height={44}
          alt="ตราโรงเรียนจอมทอง"
        />
        <span>
          กล่องแดง
          <small>โรงเรียนจอมทอง</small>
        </span>
      </Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/track" aria-label="ติดตามเรื่อง">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <span>ติดตามเรื่อง</span>
        </Link>
        <Link href="/admin/login" aria-label="เข้าสู่ระบบสำหรับเจ้าหน้าที่">
          <FontAwesomeIcon icon={faUserShield} />
          <span>เจ้าหน้าที่</span>
        </Link>
        <Link href="/report" className="rb-cta">
          <FontAwesomeIcon icon={faPaperPlane} />
          <span>แจ้งเรื่อง</span>
        </Link>
      </nav>
    </header>
  );
}

const homeTopics: Record<string, { icon: IconDefinition; tone: string; label: string; note: string }> = {
  bullying: { icon: faUserShield, tone: "sky", label: "การกลั่นแกล้ง", note: "โดนล้อ โดนแกล้ง โดนกีดกัน" },
  mental: { icon: faHeartPulse, tone: "mint", label: "สุขภาพใจ", note: "เครียด กังวล อยากมีคนคุย" },
  violence: { icon: faHand, tone: "rose", label: "ความรุนแรง", note: "ถูกทำร้าย ข่มขู่ คุกคาม" },
  safety: { icon: faTriangleExclamation, tone: "yel", label: "ความปลอดภัย", note: "เจอสิ่งที่อาจเป็นอันตราย" },
  study: { icon: faBookOpen, tone: "lav", label: "การเรียน", note: "เรียน งาน สอบ" },
  facility: { icon: faSchool, tone: "orange", label: "อาคาร / สถานที่", note: "ของพัง ชำรุด ไม่สะอาด" },
  suggestion: { icon: faLightbulb, tone: "pink", label: "ข้อเสนอแนะ", note: "ไอเดียที่อยากให้โรงเรียนทำ" },
  other: { icon: faMessage, tone: "gray", label: "อื่น ๆ", note: "เรื่องที่ไม่ตรงกับข้อไหน" },
};

const homeSteps = [
  { icon: faInbox, title: "เจ้าหน้าที่อ่าน", text: "ดูว่าเรื่องเร่งด่วนแค่ไหน" },
  { icon: faShareNodes, title: "ส่งต่อครูที่เกี่ยวข้อง", text: "เรื่องหนักส่งถึงผู้บริหาร" },
  { icon: faPeopleGroup, title: "ครูลงมือช่วย", text: "มีผู้รับผิดชอบชัดเจน" },
  { icon: faFlagCheckered, title: "ปิดเรื่อง", text: "ตรวจผลก่อนปิดทุกครั้ง" },
];

function HomeContent() {
  return (
    <main className="rb-home">
      <div className="rb-hero">
        <span className="rb-deco rb-ring" />
        <span className="rb-deco rb-ring2" />
        <span className="rb-deco rb-dots" />
        <Ic className="rb-deco rb-spark rb-s1" icon={faStar} />
        <Ic className="rb-deco rb-spark rb-s2" icon={faHeart} />
        <div className="rb-col">
          <span className="rb-tag">
            <Ic icon={faShieldHeart} />
            พื้นที่ปลอดภัยของนักเรียนจอมทอง
          </span>
          <h1>
            มีเรื่องอยากบอก
            <br />
            <em>บอกได้ที่นี่</em>
          </h1>
          <p className="rb-lead">
            โดนแกล้ง เครียด ของในโรงเรียนพัง หรือมีไอเดียดี ๆ
            ส่งถึงโรงเรียนได้ใน 3 นาที ไม่บอกชื่อก็ได้
          </p>
          <div className="rb-actions">
            <Link className="rb-btn rb-white" href="/report">
              <Ic icon={faPenToSquare} />
              แจ้งเรื่องเลย
              <Ic icon={faArrowRight} />
            </Link>
            <Link className="rb-btn rb-ghost" href="/track">
              <Ic icon={faMagnifyingGlass} />
              ติดตามเรื่อง
            </Link>
          </div>
          <div className="rb-trust">
            <span>
              <Ic icon={faCheckCircle} />
              เลือกปกปิดตัวตนได้
            </span>
            <span>
              <Ic icon={faCheckCircle} />
              ข้อมูลได้รับการดูแล
            </span>
            <span>
              <Ic icon={faCheckCircle} />
              ใช้ได้บนมือถือ
            </span>
          </div>
        </div>
        <div className="rb-col rb-scene" aria-hidden="true">
          <span className="rb-sun" />
          <div className="rb-float rb-f1">
            <span className="rb-ava">
              <Ic icon={faUserSecret} />
            </span>
            <div className="rb-bubble">
              <small>
                <Ic icon={faEyeSlash} />
                ม.2 · ไม่ระบุชื่อ
              </small>
              เพื่อนโดนล้อในห้องทุกวัน
            </div>
          </div>
          <div className="rb-float rb-f2">
            <div className="rb-bubble rb-mint">
              <small>
                <Ic icon={faUser} />
                ม.5
              </small>
              ก๊อกน้ำชั้น 2 เสีย
            </div>
            <span className="rb-ava rb-m">
              <Ic icon={faWrench} />
            </span>
          </div>
          <div className="rb-redbox">
            <span className="rb-letter">
              <Ic icon={faHeart} />
            </span>
            <span className="rb-lid">
              <span className="rb-slot" />
            </span>
            <span className="rb-body">
              <span className="rb-plate">
                <Ic icon={faEnvelopeOpenText} />
                <b>กล่องแดง</b>
                <small>RED BOX</small>
              </span>
            </span>
            <span className="rb-ground" />
          </div>
          <div className="rb-float rb-f3">
            <div className="rb-bubble rb-dark">
              <Ic icon={faCheck} />
              รับเรื่องแล้ว กำลังส่งต่อให้ครู
            </div>
          </div>
        </div>
      </div>

      <div className="rb-bento">
        <div className="rb-tile rb-t1">
          <span className="rb-ico">
            <Ic icon={faUserSecret} />
          </span>
          <Ic className="rb-ghosticon" icon={faUserSecret} />
          <b>ไม่บอกชื่อก็ได้</b>
          <span>เลือกปกปิดตัวตน ครูทั่วไปจะไม่เห็นชื่อ</span>
        </div>
        <div className="rb-tile rb-t2">
          <span className="rb-ico">
            <Ic icon={faRoute} />
          </span>
          <Ic className="rb-ghosticon" icon={faRoute} />
          <b>ติดตามได้เอง</b>
          <span>กลับมาดูได้ตลอดว่าเรื่องไปถึงไหนแล้ว</span>
        </div>
        <div className="rb-tile rb-t3">
          <span className="rb-ico">
            <Ic icon={faHandHoldingHeart} />
          </span>
          <Ic className="rb-ghosticon" icon={faHandHoldingHeart} />
          <b>มีคนรับเรื่องจริง</b>
          <span>ทุกเรื่องมีครูผู้รับผิดชอบ ไม่หายเงียบ</span>
        </div>
      </div>

      <section>
        <span className="rb-kicker">
          <Ic icon={faComments} />
          บอกได้ทุกเรื่อง
        </span>
        <h2>
          อยากบอก<u>เรื่องอะไร</u>
        </h2>
        <p className="rb-sub">แตะหัวข้อที่ใกล้ที่สุดได้เลย ไม่ต้องกลัวเลือกผิด</p>
        <div className="rb-topics">
          {categoryFallbacks.map((category) => {
            const topic = homeTopics[category.id];
            return (
              <Link className="rb-topic" href="/report" key={category.id}>
                <span className={`rb-dot rb-c-${topic.tone}`}>
                  <Ic icon={topic.icon} />
                </span>
                <span className="rb-go">
                  <Ic icon={faArrowRight} />
                </span>
                <span>
                  {topic.label}
                  <small>{topic.note}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <span className="rb-kicker">
          <Ic icon={faDiagramProject} />
          ขั้นตอน
        </span>
        <h2>
          ส่งแล้ว<u>เกิดอะไรขึ้น</u>
        </h2>
        <div className="rb-steps">
          {homeSteps.map((step, index) => (
            <div className="rb-step" key={step.title}>
              <span className="rb-num">
                <Ic icon={step.icon} />
                <em>{index + 1}</em>
              </span>
              <b>{step.title}</b>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rb-sos">
        <span className="rb-bell">
          <Ic icon={faBell} />
        </span>
        <div>
          <b>อันตรายตอนนี้เลย?</b>
          อย่ารอระบบ บอกครูที่อยู่ใกล้ที่สุด หรือโทรหากิจการนักเรียนทันที
        </div>
        <a href="tel:053341550">
          <Ic icon={faPhone} />
          กิจการนักเรียน 053-341-550
        </a>
      </div>
    </main>
  );
}

function ReportWizard({ notify }: { notify: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const formTopRef = useRef<HTMLElement | null>(null);
  const hasChangedStep = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [trackingPassword, setTrackingPassword] = useState("");
  const [trackingPasswordConfirm, setTrackingPasswordConfirm] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [form, setForm] = useState({
    categoryId: "",
    isAnonymous: true,
    title: "",
    description: "",
    location: "",
    peopleInvolved: "",
    requestedHelp: "ขอคำปรึกษา",
    safetyLevel: "SAFE" as "SAFE" | "UNSURE" | "UNSAFE",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => readJson<{ categories: Category[] }>(r))
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      if (formTopRef.current)
        formTopRef.current.scrollIntoView({ behavior, block: "start" });
      else window.scrollTo({ top: 0, behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  async function verifyStudent(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/students/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentCode }),
      });
      const data = await readJson<{ student: Student; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(data.error);
      setStudent(data.student);
      notify("พบข้อมูลนักเรียนแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถตรวจสอบข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  function canContinue() {
    if (step === 1)
      return (
        Boolean(student) &&
        (student?.has_identity_number
          ? isValidStudentIdentity(identityNumber)
          : /^\d{6}$/.test(trackingPassword) && trackingPassword === trackingPasswordConfirm)
      );
    if (step === 2) return Boolean(form.categoryId);
    if (step === 3)
      return (
        form.title.trim().length >= 5 && form.description.trim().length >= 10
      );
    return true;
  }

  async function submitReport() {
    if (!student || loading || !pdpaAccepted) return;
    setLoading(true);
    setError("");
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          studentId: student.id,
          identityNumber: student.has_identity_number ? normalizeStudentIdentity(identityNumber) : undefined,
          trackingPassword: student.has_identity_number ? undefined : trackingPassword,
          idempotencyKey: idempotencyKeyRef.current,
          pdpaConsent: pdpaAccepted,
        }),
      });
      const data = await readJson<{
        caseNumber: string;
        uploadToken: string;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error);
      for (const file of files) {
        const upload = new FormData();
        upload.set("caseNumber", data.caseNumber);
        upload.set("uploadToken", data.uploadToken);
        upload.set("file", file);
        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: upload,
        });
        if (!uploadResponse.ok)
          throw new Error(
            "ส่งเรื่องแล้ว แต่มีไฟล์หลักฐานบางรายการอัปโหลดไม่สำเร็จ",
          );
      }
      setCaseNumber(data.caseNumber);
      setStep(7);
      notify("ส่งเรื่องเรียบร้อยแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถส่งเรื่องได้");
    } finally {
      setLoading(false);
    }
  }

  if (step === 7) {
    return (
      <main className="form-page">
        <section className="success-card">
          <span className="success-icon">
            <FontAwesomeIcon icon={faCheck} />
          </span>
          <span className="eyebrow">รับเรื่องไว้แล้วนะ</span>
          <h1>ขอบคุณที่ไว้ใจเรา</h1>
          <p>
            เจ้าหน้าที่จะค่อย ๆ ดูแลตามขั้นตอน
            เก็บหมายเลขเคสนี้ไว้สำหรับติดตามความคืบหน้าได้เลย
          </p>
          <div className="case-number">
            <small>หมายเลขเคส</small>
            <strong>{caseNumber}</strong>
          </div>
          <div className="success-actions">
            <button
              className="button secondary"
              onClick={() => {
                navigator.clipboard.writeText(caseNumber);
                notify("คัดลอกหมายเลขเคสแล้ว");
              }}
            >
              <FontAwesomeIcon icon={faCopy} /> คัดลอกหมายเลขเคส
            </button>
            <Link className="button primary" href="/track">
              <FontAwesomeIcon icon={faMagnifyingGlass} /> ติดตามความคืบหน้า
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="form-page">
      <section className="form-wrap" ref={formTopRef}>
        <div className="form-intro">
          <span className="eyebrow">แจ้งเรื่องอย่างปลอดภัย</span>
          <h1>
            {step === 1 ? "เริ่มจากข้อมูลเบื้องต้น" : "เล่าให้เราฟังได้เลย"}
          </h1>
          <p>ใช้เวลาประมาณ 3–5 นาที และย้อนกลับมาแก้ข้อมูลได้ทุกขั้นตอน</p>
        </div>
        <div className="stepper" aria-label={`ขั้นตอนที่ ${step} จาก 6`}>
          {[
            "ข้อมูลของฉัน",
            "ประเภทเรื่อง",
            "รายละเอียด",
            "ความช่วยเหลือ",
            "หลักฐาน",
            "ตรวจสอบ",
          ].map((label, index) => (
            <div key={label} className={index + 1 <= step ? "active" : ""}>
              <span>
                {index + 1 < step ? (
                  <FontAwesomeIcon icon={faCheck} />
                ) : (
                  index + 1
                )}
              </span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <div className="wizard-card">
          {step === 1 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faUserGraduate} />
                <div>
                  <h2>ยืนยันข้อมูลนักเรียน</h2>
                  <p>กรอกเลขประจำตัวนักเรียนเพื่อค้นหาข้อมูล</p>
                </div>
              </div>
              <form onSubmit={verifyStudent} className="lookup-row">
                <label>
                  <span>เลขประจำตัวนักเรียน</span>
                  <input
                    inputMode="numeric"
                    value={studentCode}
                    onChange={(e) => {
                      setStudentCode(e.target.value.replace(/\D/g, ""));
                      setStudent(null);
                      setIdentityNumber("");
                      setTrackingPassword("");
                      setTrackingPasswordConfirm("");
                    }}
                    placeholder="เช่น 12345"
                    maxLength={10}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={loading || studentCode.length < 4}
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> กำลังค้นหา...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faMagnifyingGlass} /> ค้นหาข้อมูล
                    </>
                  )}
                </button>
              </form>
              {student && (
                <>
                  <div className="student-card">
                    <span>
                      <FontAwesomeIcon icon={faUserGraduate} />
                    </span>
                    <div>
                      <small>ข้อมูลที่ค้นพบ</small>
                      <h3>
                        {student.prefix}
                        {student.first_name} {student.last_name}
                      </h3>
                      <p>
                        {student.level}/{student.classroom} เลขที่{" "}
                        {student.number}
                      </p>
                      <p className="advisor">
                        ครูที่ปรึกษา:{" "}
                        {student.advisor_names.length
                          ? student.advisor_names.join(" / ")
                          : "ยังไม่กำหนด"}
                      </p>
                    </div>
                    <FontAwesomeIcon
                      className="verified"
                      icon={faCheckCircle}
                    />
                  </div>
                  {student.has_identity_number ? <div className="tracking-password-box">
                    <div>
                      <FontAwesomeIcon icon={faShieldHalved} />
                      <span>
                        <b>ยืนยันว่าเป็นข้อมูลของนักเรียน</b>
                        <small>
                          ใช้เลขประจำตัวบุคคลเดิมทุกครั้ง ไม่ต้องตั้งรหัสติดตามใหม่
                        </small>
                      </span>
                    </div>
                    <label>
                      <span>เลขประจำตัวบุคคล / รหัส G</span>
                      <input
                        type="password"
                        autoComplete="off"
                        value={identityNumber}
                        onChange={(e) => setIdentityNumber(e.target.value.toUpperCase().replace(/[^0-9G๐-๙\s-]/g, "").slice(0, 17))}
                        maxLength={17}
                        placeholder="เลข 13 หลัก หรือ G ตามด้วย 12 หลัก"
                      />
                    </label>
                    {identityNumber && !isValidStudentIdentity(identityNumber) && <small className="password-mismatch">{studentIdentityError(identityNumber)}</small>}
                    <small className="field-help">รองรับเลขประจำตัวบุคคลไทย 13 หลัก รวมผู้ถือบัตรที่ขึ้นต้น 0 หรือ 8 และ G Code ของกระทรวงศึกษาธิการ</small>
                  </div> : <div className="tracking-password-box">
                    <div><FontAwesomeIcon icon={faShieldHalved} /><span><b>ตั้งรหัสติดตามชั่วคราว</b><small>ข้อมูลเลขประจำตัวบุคคลยังไม่ได้นำเข้า จึงใช้รหัส 6 หลักสำหรับเรื่องนี้ไปก่อน</small></span></div>
                    <label><span>รหัสติดตาม 6 หลัก</span><input type="password" inputMode="numeric" value={trackingPassword} onChange={(e) => setTrackingPassword(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="••••••" /></label>
                    <label><span>ยืนยันรหัสอีกครั้ง</span><input type="password" inputMode="numeric" value={trackingPasswordConfirm} onChange={(e) => setTrackingPasswordConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="••••••" /></label>
                    {trackingPasswordConfirm && trackingPassword !== trackingPasswordConfirm && <small className="password-mismatch">รหัสทั้งสองช่องยังไม่ตรงกัน</small>}
                  </div>}
                </>
              )}
              <p className="helper">
                <FontAwesomeIcon icon={faShieldHalved} />{" "}
                ระบบใช้ข้อมูลนี้เพื่อยืนยันสิทธิ์และติดตามเรื่องเท่านั้น
              </p>
            </div>
          )}
          {step === 2 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faFolderOpen} />
                <div>
                  <h2>เรื่องที่อยากบอก</h2>
                  <p>เลือกประเภทที่ใกล้เคียงที่สุด</p>
                </div>
              </div>
              <div className="choice-grid">
                {(categories.length ? categories : categoryFallbacks).map(
                  (category, index) => (
                    <button
                      key={category.id}
                      className={
                        form.categoryId === category.id
                          ? "choice selected"
                          : "choice"
                      }
                      onClick={() =>
                        setForm({ ...form, categoryId: category.id })
                      }
                    >
                      <FontAwesomeIcon
                        icon={categoryIcons[index % categoryIcons.length]}
                      />
                      <span>{category.name}</span>
                      {form.categoryId === category.id && (
                        <FontAwesomeIcon
                          className="choice-check"
                          icon={faCheckCircle}
                        />
                      )}
                    </button>
                  ),
                )}
              </div>
              <fieldset className="privacy-field">
                <legend>การแสดงตัวตนต่อเจ้าหน้าที่ทั่วไป</legend>
                <label className={form.isAnonymous ? "selected" : ""}>
                  <input
                    type="radio"
                    checked={form.isAnonymous}
                    onChange={() => setForm({ ...form, isAnonymous: true })}
                  />
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <span>
                    <b>ปกปิดตัวตน</b>
                    <small>เจ้าหน้าที่ทั่วไปจะไม่เห็นชื่อ ชั้น ห้อง</small>
                  </span>
                </label>
                <label className={!form.isAnonymous ? "selected" : ""}>
                  <input
                    type="radio"
                    checked={!form.isAnonymous}
                    onChange={() => setForm({ ...form, isAnonymous: false })}
                  />
                  <FontAwesomeIcon icon={faUserGraduate} />
                  <span>
                    <b>เปิดเผยตัวตน</b>
                    <small>ช่วยให้เจ้าหน้าที่ติดต่อช่วยเหลือได้เร็วขึ้น</small>
                  </span>
                </label>
              </fieldset>
            </div>
          )}
          {step === 3 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faMessage} />
                <div>
                  <h2>เล่าให้เราฟัง</h2>
                  <p>เล่าเท่าที่สบายใจ ไม่จำเป็นต้องเล่าทุกอย่างในครั้งเดียว</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="full">
                  <span className="field-label">
                    <FontAwesomeIcon icon={faHeading} />
                    หัวข้อเรื่อง *
                  </span>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="สรุปสั้น ๆ ว่าเกิดอะไรขึ้น"
                    maxLength={160}
                  />
                </label>
                <label className="full">
                  <span className="field-label">
                    <FontAwesomeIcon icon={faAlignLeft} />
                    เกิดอะไรขึ้น? *
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="เล่าเหตุการณ์เท่าที่สะดวก เราพร้อมรับฟัง"
                    rows={7}
                    maxLength={5000}
                  />
                </label>
                <label>
                  <span className="field-label">
                    <FontAwesomeIcon icon={faLocationDot} />
                    สถานที่เกิดเหตุ
                  </span>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="ไม่บังคับ"
                  />
                </label>
                <label>
                  <span className="field-label">
                    <FontAwesomeIcon icon={faPeopleGroup} />
                    บุคคลที่เกี่ยวข้อง
                  </span>
                  <input
                    value={form.peopleInvolved}
                    onChange={(e) =>
                      setForm({ ...form, peopleInvolved: e.target.value })
                    }
                    placeholder="ไม่บังคับ"
                  />
                </label>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faHeart} />
                <div>
                  <h2>อยากให้โรงเรียนช่วยอย่างไร?</h2>
                  <p>เลือกสิ่งที่ต้องการมากที่สุดในตอนนี้</p>
                </div>
              </div>
              <div className="help-options">
                {helpOptions.map((item) => (
                  <button
                    key={item.label}
                    className={
                      form.requestedHelp === item.label ? "selected" : ""
                    }
                    onClick={() =>
                      setForm({ ...form, requestedHelp: item.label })
                    }
                  >
                    <FontAwesomeIcon icon={item.icon} />
                    {item.label}
                  </button>
                ))}
              </div>
              <fieldset className="safety-field">
                <legend>ตอนนี้รู้สึกปลอดภัยดีไหม?</legend>
                {[
                  ["SAFE", "ปลอดภัย", "green", faShieldHalved],
                  ["UNSURE", "กังวล / ไม่แน่ใจ", "amber", faCircleInfo],
                  ["UNSAFE", "ไม่ปลอดภัย", "red", faTriangleExclamation],
                ].map(([value, label, tone, icon]) => (
                  <label
                    className={`${tone} ${form.safetyLevel === value ? "selected" : ""}`}
                    key={String(value)}
                  >
                    <input
                      type="radio"
                      checked={form.safetyLevel === value}
                      onChange={() =>
                        setForm({
                          ...form,
                          safetyLevel: value as typeof form.safetyLevel,
                        })
                      }
                    />
                    <FontAwesomeIcon icon={icon as typeof faShieldHalved} />
                    <b>{String(label)}</b>
                  </label>
                ))}
              </fieldset>
              {form.safetyLevel === "UNSAFE" && (
                <div className="urgent-message">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  <span>
                    <b>เราจะส่งเรื่องนี้ให้เจ้าหน้าที่ตรวจสอบทันที</b>
                    <small>
                      หากอยู่ในอันตรายเร่งด่วน
                      ให้ติดต่อครูที่อยู่ใกล้ที่สุด หรือโทรกิจการนักเรียน 053-341-550
                    </small>
                  </span>
                </div>
              )}
            </div>
          )}
          {step === 5 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faFileArrowUp} />
                <div>
                  <h2>แนบหลักฐาน</h2>
                  <p>ไม่บังคับ — แนบเฉพาะไฟล์ที่สะดวก</p>
                </div>
              </div>
              <label className="dropzone">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? [])
                      .filter((file) => file.size <= 8 * 1024 * 1024)
                      .slice(0, 5);
                    setFiles(selected);
                    if ((e.target.files?.length ?? 0) > selected.length)
                      notify("เลือกได้สูงสุด 5 ไฟล์ และไฟล์ละไม่เกิน 8 MB");
                  }}
                />
                <FontAwesomeIcon icon={faFileArrowUp} />
                <b>เลือกไฟล์หลักฐาน</b>
                <span>JPG, PNG, WEBP หรือ PDF · สูงสุด 5 ไฟล์</span>
              </label>
              {files.length > 0 && (
                <div className="file-list file-preview-grid">
                  {files.map((file) => (
                    <LocalEvidenceFile
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      file={file}
                      onRemove={() =>
                        setFiles(files.filter((item) => item !== file))
                      }
                    />
                  ))}
                </div>
              )}
              <p className="helper">
                <FontAwesomeIcon icon={faShieldHalved} />{" "}
                ไฟล์จะถูกจัดเก็บแบบส่วนตัวและเปิดได้เฉพาะผู้มีสิทธิ์
              </p>
            </div>
          )}
          {step === 6 && (
            <div className="wizard-content">
              <div className="card-heading">
                <FontAwesomeIcon icon={faCheckCircle} />
                <div>
                  <h2>ตรวจสอบก่อนส่ง</h2>
                  <p>ตรวจข้อมูลอีกครั้ง เมื่อพร้อมแล้วกดส่งเรื่องได้เลย</p>
                </div>
              </div>
              <div className="review-grid">
                <Review
                  label="ผู้แจ้ง"
                  value={
                    form.isAnonymous
                      ? "ปกปิดตัวตน"
                      : `${student?.prefix}${student?.first_name} ${student?.last_name}`
                  }
                />
                <Review
                  label="ประเภท"
                  value={
                    (
                      categories.find((c) => c.id === form.categoryId) ??
                      categoryFallbacks.find((c) => c.id === form.categoryId)
                    )?.name ?? "-"
                  }
                />
                <Review label="หัวข้อ" value={form.title} />
                <Review label="ต้องการให้ช่วย" value={form.requestedHelp} />
                <Review
                  label="ความปลอดภัย"
                  value={
                    form.safetyLevel === "SAFE"
                      ? "ปลอดภัย"
                      : form.safetyLevel === "UNSURE"
                        ? "กังวล / ไม่แน่ใจ"
                        : "ไม่ปลอดภัย"
                  }
                />
                <Review
                  label="หลักฐาน"
                  value={files.length ? `${files.length} ไฟล์` : "ไม่ได้แนบ"}
                />
                <div className="review-detail">
                  <small>รายละเอียด</small>
                  <p>{form.description}</p>
                </div>
              </div>
              <section className="pdpa-box" aria-labelledby="pdpa-title">
                <div className="pdpa-head">
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <div>
                    <h3 id="pdpa-title">การใช้ข้อมูลส่วนบุคคล (PDPA)</h3>
                    <p>อ่านให้ครบก่อนกดยอมรับ</p>
                  </div>
                </div>
                <ul className="pdpa-points">
                  <li>
                    <FontAwesomeIcon icon={faFolderOpen} />
                    <span>
                      <b>ข้อมูลที่เก็บ</b>
                      ชื่อ ชั้น ห้อง เลขประจำตัวนักเรียน เรื่องที่แจ้ง
                      และไฟล์หลักฐานที่แนบ
                    </span>
                  </li>
                  <li>
                    <FontAwesomeIcon icon={faHeart} />
                    <span>
                      <b>ใช้เพื่ออะไร</b>
                      เพื่อรับเรื่อง ดูแลช่วยเหลือ
                      และติดตามผลให้นักเรียนเท่านั้น
                    </span>
                  </li>
                  <li>
                    <FontAwesomeIcon icon={faPeopleGroup} />
                    <span>
                      <b>ใครเห็นได้</b>
                      เจ้าหน้าที่รับเรื่อง ครูที่ได้รับมอบหมาย
                      และผู้บริหารที่เกี่ยวข้องกับเรื่องนี้
                    </span>
                  </li>
                </ul>
                <details className="pdpa-more">
                  <summary>อ่านรายละเอียดทั้งหมด</summary>
                  <div>
                    <p>
                      โรงเรียนจอมทองเก็บและใช้ข้อมูลข้างต้นเพื่อการดูแลช่วยเหลือนักเรียนผ่านระบบกล่องแดง
                      ข้อมูลจะไม่ถูกเปิดเผยต่อบุคคลภายนอกโรงเรียน
                      เว้นแต่จำเป็นเพื่อความปลอดภัยของนักเรียนหรือกฎหมายกำหนด
                    </p>
                    <p>
                      หากเลือกปกปิดตัวตน ครูและเจ้าหน้าที่ทั่วไปจะไม่เห็นชื่อ
                      แต่ระบบยังบันทึกว่าเรื่องมาจากใคร
                      เพื่อให้ช่วยเหลือได้เมื่อจำเป็น
                    </p>
                    <p>
                      เลขประจำตัวประชาชนหรือรหัส G
                      ใช้ยืนยันตัวตนเท่านั้น ระบบไม่เก็บเลขจริงไว้
                    </p>
                    <p>
                      นักเรียนมีสิทธิ์ขอดู ขอแก้ไข หรือขอลบข้อมูลของตนเอง
                      และถอนความยินยอมได้
                      โดยติดต่อกิจการนักเรียน โทร 053-341-550
                    </p>
                  </div>
                </details>
                <label className={pdpaAccepted ? "pdpa-accept checked" : "pdpa-accept"}>
                  <input
                    type="checkbox"
                    checked={pdpaAccepted}
                    onChange={(e) => setPdpaAccepted(e.target.checked)}
                  />
                  <span className="pdpa-tick">
                    <FontAwesomeIcon icon={faCheck} />
                  </span>
                  <span>
                    ฉันอ่านและยอมรับให้โรงเรียนเก็บและใช้ข้อมูลตามที่ระบุไว้ข้างต้น
                  </span>
                </label>
              </section>
            </div>
          )}
          {error && (
            <div className="inline-error" role="alert">
              <FontAwesomeIcon icon={faCircleInfo} /> {error}
            </div>
          )}
          <div className="wizard-actions">
            {step > 1 ? (
              <button
                className="button secondary"
                onClick={() => setStep(step - 1)}
              >
                <FontAwesomeIcon icon={faArrowLeft} /> ย้อนกลับ
              </button>
            ) : (
              <Link href="/" className="button secondary">
                <FontAwesomeIcon icon={faArrowLeft} /> กลับหน้าแรก
              </Link>
            )}
            <span>ขั้นตอน {step} จาก 6</span>
            {step < 6 ? (
              <button
                className="button primary"
                disabled={!canContinue()}
                onClick={() => setStep(step + 1)}
              >
                ถัดไป <FontAwesomeIcon icon={faArrowRight} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={loading || !pdpaAccepted}
                title={pdpaAccepted ? undefined : "กดยอมรับการใช้ข้อมูลส่วนบุคคลก่อนส่งเรื่อง"}
                onClick={submitReport}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> กำลังส่ง...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} /> ส่งเรื่อง
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function LocalEvidenceFile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const [previewUrl] = useState(() =>
    isImage ? URL.createObjectURL(file) : "",
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <article
      className={isImage ? "local-file-card image" : "local-file-card document"}
    >
      <div className="local-file-preview">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={`ภาพตัวอย่าง ${file.name}`} />
        ) : (
          <FontAwesomeIcon icon={faFileArrowUp} />
        )}
        <button
          type="button"
          aria-label={`นำ ${file.name} ออก`}
          title="นำไฟล์ออก"
          onClick={onRemove}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="local-file-meta">
        <b>{file.name}</b>
        <small>
          {isImage ? "ไฟล์รูปภาพ" : "เอกสาร PDF"} ·{" "}
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </small>
      </div>
    </article>
  );
}

const reviewIcons = {
  ผู้แจ้ง: faUserShield,
  ประเภท: faFolderOpen,
  หัวข้อ: faMessage,
  ต้องการให้ช่วย: faHeart,
  ความปลอดภัย: faShieldHalved,
  หลักฐาน: faFileArrowUp,
  ผู้รับผิดชอบ: faUserShield,
  "ชั้น / ห้อง": faSchool,
  ครูที่ปรึกษา: faUserGraduate,
} as const;
function Review({ label, value }: { label: string; value: string }) {
  const icon = reviewIcons[label as keyof typeof reviewIcons] ?? faCircleInfo;
  return (
    <div>
      <small>
        <FontAwesomeIcon icon={icon} />
        {label}
      </small>
      <b>{value}</b>
    </div>
  );
}

function Tracking({ notify }: { notify: (message: string) => void }) {
  const [studentCode, setStudentCode] = useState("");
  const [credential, setCredential] = useState("");
  const [items, setItems] = useState<Array<Record<string, string>>>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function track(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setItems([]);
    setSearched(false);
    try {
      const response = await fetch("/api/cases/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentCode, credential: normalizeStudentIdentity(credential) }),
      });
      const data = await readJson<{
        cases: Array<Record<string, string>>;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error);
      setItems(data.cases ?? []);
      setSearched(true);
      notify(
        data.cases?.length
          ? "พบข้อมูลความคืบหน้าแล้ว"
          : "ยังไม่มีเรื่องที่ส่งเข้ามา",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ค้นหาข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะ",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="tracking-page">
      <section className="tracking-wrap">
        <div className="form-intro">
          <span className="eyebrow">ติดตามความคืบหน้า</span>
          <h1>ตรวจสอบสถานะเรื่อง</h1>
          <p>
            ใช้เลขประจำตัวนักเรียนคู่กับเลขประจำตัวบุคคล หรือรหัสติดตามเดิมระหว่างรอนำเข้าข้อมูลทะเบียน
          </p>
        </div>
        <div className="tracking-card">
          <form onSubmit={track} className="tracking-form">
            <label>
              <span>เลขประจำตัวนักเรียน</span>
              <input
                value={studentCode}
                inputMode="numeric"
                onChange={(e) => {
                  setStudentCode(e.target.value.replace(/\D/g, ""));
                  setSearched(false);
                }}
                placeholder="เช่น 12345"
                maxLength={10}
              />
            </label>
            <label>
              <span>เลขประจำตัวบุคคล / รหัส G / รหัสติดตามเดิม</span>
              <input
                type="password"
                value={credential}
                autoComplete="off"
                onChange={(e) => {
                  setCredential(e.target.value.toUpperCase().replace(/[^0-9G๐-๙\s-]/g, "").slice(0, 17));
                  setSearched(false);
                }}
                placeholder="เลข 13 หลัก หรือ G ตามด้วย 12 หลัก"
                maxLength={17}
              />
              {credential && !isValidStudentIdentity(credential) && !/^\d{6}$/.test(credential) && <small className="password-mismatch">กรอกเลขประจำตัวบุคคล, G Code หรือรหัสเดิม 6 หลัก</small>}
            </label>
            <button
              className="button primary"
              disabled={
                loading ||
                studentCode.length < 4 ||
                (!isValidStudentIdentity(credential) && !/^\d{6}$/.test(credential))
              }
            >
              {loading ? (
                <>
                  <span className="spinner" /> กำลังค้นหา...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faMagnifyingGlass} /> ดูความคืบหน้า
                </>
              )}
            </button>
          </form>
          {error && (
            <div className="inline-error">
              <FontAwesomeIcon icon={faCircleInfo} /> {error}
            </div>
          )}
          {searched && items.length === 0 && (
            <div className="tracking-empty">
              <FontAwesomeIcon icon={faBoxOpen} />
              <b>ยังไม่มีเรื่องที่ส่งเข้ามา</b>
              <small>เมื่อส่งเรื่องแล้ว ความคืบหน้าจะแสดงที่หน้านี้</small>
            </div>
          )}
          {items.length > 0 && (
            <div className="tracking-results">
              <div className="tracking-results-heading">
                <b>
                  <FontAwesomeIcon icon={faFolderOpen} /> เรื่องที่ส่งไว้
                </b>
                <span>{items.length} เรื่อง</span>
              </div>
              {items.map((item) => (
                <article
                  className="tracking-result tracking-result-compact"
                  key={item.case_number}
                >
                  <div className="tracking-result-head">
                    <span>
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </span>
                    <div>
                      <small>
                        <FontAwesomeIcon icon={faFolderOpen} />{" "}
                        {item.case_number}
                      </small>
                      <h2>{item.category_name}</h2>
                      <p>
                        <FontAwesomeIcon icon={faClock} /> แจ้งเมื่อ{" "}
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>
                </article>
              ))}
              <div className="privacy-note">
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>
                  <b>ข้อมูลที่ส่งมายังได้รับการดูแลอย่างปลอดภัย</b>
                  <small>
                    แสดงเฉพาะประเภทเรื่องและความคืบหน้า
                    โดยไม่เปิดเผยรายละเอียดที่แจ้งไว้
                  </small>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AssigneeCombobox({
  currentUsername,
  disabled,
  onSelect,
}: {
  currentUsername: string;
  disabled: boolean;
  onSelect: (username: string, displayName: string) => void;
}) {
  type Assignee = {
    username: string;
    display_name: string;
    role: "SUPER_ADMIN" | "STUDENT_AFFAIRS" | "LEVEL_HEAD" | "ADVISOR" | "STAFF";
  };
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState(currentUsername);
  const [selectedUsername, setSelectedUsername] = useState(currentUsername);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) return;
    fetch("/api/cases/assignees")
      .then(async (response) => {
        const data = await readJson<{ assignees?: Assignee[] }>(response);
        if (!response.ok) throw new Error("โหลดรายชื่อไม่สำเร็จ");
        const items = data.assignees ?? [];
        setAssignees(items);
        setLoadError("");
        const current = items.find((item) => item.username === currentUsername);
        if (current) setQuery(current.display_name);
      })
      .catch(() =>
        setLoadError("โหลดรายชื่อครูไม่สำเร็จ กรุณาลองเปิดเคสใหม่อีกครั้ง"),
      );
  }, [currentUsername, disabled]);

  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  const filtered = assignees
    .filter((item) =>
      `${item.display_name} ${item.username}`
        .toLocaleLowerCase("th-TH")
        .includes(normalizedQuery),
    )
    .slice(0, 8);
  function choose(item: Assignee) {
    setQuery(item.display_name);
    setSelectedUsername(item.username);
    onSelect(item.username, item.display_name);
    setOpen(false);
  }

  return (
    <div className="assignee-combobox">
      <div className="inline-action">
        <div className="assignee-input-wrap">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            role="combobox"
            aria-label="ค้นหาครูหรือเจ้าหน้าที่ผู้รับผิดชอบ"
            aria-expanded={open}
            aria-controls="assignee-options"
            autoComplete="off"
            value={query}
            placeholder="พิมพ์ชื่อครูหรือเจ้าหน้าที่"
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setOpen(true);
              const exact = assignees.find(
                (item) =>
                  item.display_name === value || item.username === value,
              );
              setSelectedUsername(exact?.username ?? "");
              onSelect(exact?.username ?? "", exact?.display_name ?? "");
            }}
          />
        </div>
      </div>
      {open && !disabled && (
        <div className="assignee-options" id="assignee-options" role="listbox">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.username === selectedUsername}
                key={item.username}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                <span>
                  <b>{item.display_name}</b>
                  <small>
                    {item.role === "ADVISOR" ? "ครูที่ปรึกษา" : item.role === "SUPER_ADMIN" ? "แอมินระบบ" : item.role === "LEVEL_HEAD" ? "หัวหน้าระดับ" : item.role === "STUDENT_AFFAIRS" ? "ครูกิจการนักเรียน" : "บุคลากร"}{" "}
                    · @{item.username}
                  </small>
                </span>
                {item.username === selectedUsername && (
                  <FontAwesomeIcon icon={faCheck} />
                )}
              </button>
            ))
          ) : (
            <p>ไม่พบรายชื่อที่ค้นหา</p>
          )}
        </div>
      )}
      {loadError && <small className="assignee-error">{loadError}</small>}
    </div>
  );
}

function TeamAssigneePicker({
  selected,
  lead,
  disabled,
  onChange,
}: {
  selected: string[];
  lead: string;
  disabled: boolean;
  onChange: (selected: string[], lead: string) => void;
}) {
  type Assignee = { username: string; display_name: string; role: string };
  const [items, setItems] = useState<Assignee[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/cases/assignees")
      .then(async (response) => {
        const data = await readJson<{ assignees?: Assignee[]; error?: string }>(response);
        if (!response.ok) throw new Error(data.error);
        setItems(data.assignees ?? []);
      })
      .catch(() => setError("โหลดรายชื่อครูไม่สำเร็จ กดรีเฟรชแล้วลองอีกครั้ง"));
  }, []);
  const roleLabels: Record<string, string> = { SUPER_ADMIN: "แอมินระบบ", STUDENT_AFFAIRS: "ครูกิจการนักเรียน", LEVEL_HEAD: "หัวหน้าระดับ", ADVISOR: "ครูที่ปรึกษา", STAFF: "บุคลากร" };
  const filtered = items.filter((item) => `${item.display_name} ${item.username} ${roleLabels[item.role] ?? item.role}`.toLocaleLowerCase("th-TH").includes(query.trim().toLocaleLowerCase("th-TH"))).slice(0, 20);
  const leadItem = items.find((item) => item.username === lead);
  function toggle(username: string) {
    const next = selected.includes(username) ? selected.filter((value) => value !== username) : [...selected, username];
    const nextLead = next.length === 0 ? "" : next.includes(lead) ? lead : next[0];
    onChange(next, nextLead);
  }
  return <div className="team-assignee-picker">
    <div className="assignee-input-wrap"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อบุคลากร" disabled={disabled} /></div>
    <div className={`team-selection-summary ${selected.length ? "has-selection" : ""}`}><span><b>{selected.length}</b> คนที่เลือก</span><small>{leadItem ? `ผู้รับผิดชอบหลัก: ${leadItem.display_name}` : "ยังไม่ได้เลือกผู้รับผิดชอบหลัก"}</small></div>
    {error ? <p className="assignee-error">{error}</p> : <div className="team-assignee-options">{filtered.map((item) => {
      const checked = selected.includes(item.username);
      return <div className={checked ? "selected" : ""} key={item.username}>
        <button type="button" onClick={() => toggle(item.username)} disabled={disabled} aria-pressed={checked}><FontAwesomeIcon icon={checked ? faCheckCircle : faPlus} /><span><b>{item.display_name}</b><small>{roleLabels[item.role] ?? item.role} · @{item.username}</small></span></button>
        {checked && <label><input type="radio" name="lead-assignee" checked={lead === item.username} onChange={() => onChange(selected, item.username)} /> ผู้รับผิดชอบหลัก</label>}
      </div>;
    })}</div>}
    <small className="field-help">เลือกได้หลายคน โดยคนแรกที่เลือกจะเป็นผู้รับผิดชอบหลักอัตโนมัติ และสามารถเปลี่ยนเป็นคนอื่นได้</small>
  </div>;
}

function AdminDashboard({ notify }: { notify: (message: string) => void }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [quickFilter, setQuickFilter] = useState<
    "all" | "new" | "pending" | "active" | "review" | "immediate" | "closed"
  >("all");
  const [selected, setSelected] = useState<Detail | null>(null);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState("");
  const [currentRoles, setCurrentRoles] = useState<string[]>([]);
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [transitionTarget, setTransitionTarget] = useState("");
  const [reassignmentOpen, setReassignmentOpen] = useState(false);
  const [deleteCaseOpen, setDeleteCaseOpen] = useState(false);
  const [pendingAssignee, setPendingAssignee] = useState("");
  const [pendingAssigneeName, setPendingAssigneeName] = useState("");
  const [pendingTeam, setPendingTeam] = useState<string[]>([]);
  const [leadAssignee, setLeadAssignee] = useState("");
  async function loadCases() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (severity) params.set("severity", severity);
      const response = await fetch(`/api/cases?${params}`);
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (response.status === 428) return;
      const data = await readJson<{ cases: CaseRecord[]; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(data.error);
      setCases(data.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }
  /* eslint-disable react-hooks/exhaustive-deps -- Search state intentionally controls the debounced reload. */
  useEffect(() => {
    const timer = window.setTimeout(loadCases, 280);
    return () => window.clearTimeout(timer);
  }, [search, status, severity]);
  /* eslint-enable react-hooks/exhaustive-deps */
  useEffect(() => {
    function applyDashboardFilter(event: Event) {
      const label = (event as CustomEvent<string>).detail;
      setQuickFilter(
        label === "รับเรื่องแล้ว"
          ? "new"
          : label === "รอพิจารณา / มอบหมาย"
            ? "pending"
            : label === "กำลังดำเนินการ"
              ? "active"
              : label === "รอตรวจผล / ปิด"
                ? "review"
                : label === "เสร็จสิ้น"
                  ? "closed"
                  : "all",
      );
      setStatus("");
      setSeverity("");
    }
    window.addEventListener("redbox-filter", applyDashboardFilter);
    return () =>
      window.removeEventListener("redbox-filter", applyDashboardFilter);
  }, []);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(
        async (response) =>
          (await response.json()) as {
            user?: { role?: string; roles?: string[]; username?: string; displayName?: string };
          },
      )
      .then((data) => {
        setCurrentRole(data.user?.role ?? "");
        setCurrentRoles(data.user?.roles ?? (data.user?.role ? [data.user.role] : []));
        setCurrentUsername(data.user?.username ?? "");
        setCurrentDisplayName(
          data.user?.displayName ?? data.user?.username ?? "ผู้ดูแลระบบ",
        );
      })
      .catch(() => undefined);
  }, []);
  const selectedCaseNumber = selected?.case.case_number;
  useEffect(() => {
    if (!selectedCaseNumber) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedCaseNumber]);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      const childModalOpen = Boolean(previewFile || transitionTarget || reassignmentOpen || deleteCaseOpen);
      if (event.key === "Escape" && !childModalOpen && !saving) setSelected(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected, previewFile, transitionTarget, reassignmentOpen, deleteCaseOpen, saving]);
  async function openCase(caseNumber: string) {
    try {
      const response = await fetch(`/api/cases/${caseNumber}`);
      const data = await readJson<Detail & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      setNote("");
      setNoteEditorOpen(false);
      setEditingNoteId(null);
      setReassignmentOpen(false);
      setPendingAssignee(String(data.case.assigned_to ?? ""));
      setPendingAssigneeName(
        String(data.case.assigned_name ?? data.case.assigned_to ?? ""),
      );
      setPendingTeam((data.assignments ?? []).map((item) => item.username));
      setLeadAssignee((data.assignments ?? []).find((item) => item.assignment_role === "LEAD")?.username ?? String(data.case.assigned_to ?? ""));
      setSelected(data);
    } catch (error) {
      notify(error instanceof Error && error.message ? error.message : "ไม่สามารถโหลดรายละเอียดเคสได้");
    }
  }
  async function updateCase(payload: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cases/${selected.case.case_number}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      notify("บันทึกข้อมูลเรียบร้อยแล้ว");
      setNote("");
      setTransitionTarget("");
      setReassignmentOpen(false);
      await loadCases();
      await openCase(selected.case.case_number);
    } catch (e) {
      notify(e instanceof Error ? e.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
    }
  }
  async function deleteCase() {
    if (!selected || !hasRole("SUPER_ADMIN")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cases/${selected.case.case_number}`, {
        method: "DELETE",
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      setDeleteCaseOpen(false);
      setSelected(null);
      notify("ลบเคสเรียบร้อยแล้ว");
      await loadCases();
    } catch (error) {
      notify(error instanceof Error ? error.message : "ไม่สามารถลบเคสได้");
    } finally {
      setSaving(false);
    }
  }
  const counts = useMemo(
    () => ({
      all: cases.length,
      new: cases.filter((c) => matchesDashboardStatus("new", c.status)).length,
      pending: cases.filter((c) => matchesDashboardStatus("pending", c.status)).length,
      active: cases.filter((c) => matchesDashboardStatus("active", c.status)).length,
      review: cases.filter((c) => matchesDashboardStatus("review", c.status)).length,
      immediate: cases.filter((c) => c.requires_immediate_review).length,
      closed: cases.filter((c) => matchesDashboardStatus("closed", c.status)).length,
    }),
    [cases],
  );
  const visibleCases =
    quickFilter === "all"
      ? cases
      : quickFilter === "immediate"
        ? cases.filter((item) => item.requires_immediate_review)
        : cases.filter((item) => matchesDashboardStatus(quickFilter, item.status));
  const selectedStatus = String(selected?.case.status ?? "");
  const hasRole = (role: string) => currentRole === "SUPER_ADMIN" || currentRoles.includes("SUPER_ADMIN") || currentRole === role || currentRoles.includes(role);
  const isCurrentAssignee = Boolean(
    selected && currentUsername && String(selected.case.assigned_to ?? "") === currentUsername,
  );
  const isTeamMember = Boolean(selected?.assignments?.some((item) => item.username === currentUsername));
  const canChooseAssignee = Boolean(
    selected &&
    selectedStatus === "SCREENING" &&
    (hasRole("SUPER_ADMIN") || hasRole("INTAKE")),
  );
  const groupedVisibleCases = statusGroups
    .map((group) => ({ ...group, cases: visibleCases.filter((item) => group.statuses.includes(item.status)) }))
    .filter((group) => group.cases.length > 0);
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <Link className="admin-brand" href="/">
          <img
            className="school-logo"
            src="/images/chomthong-logo.png"
            width={52}
            height={52}
            alt="ตราโรงเรียนจอมทอง"
          />
          <span>
            <b>กล่องแดง</b>
            <small>โรงเรียนจอมทอง</small>
          </span>
        </Link>
        <nav>
          <span className="nav-label">ภาพรวม</span>
          <button
            type="button"
            className={quickFilter === "all" ? "active" : ""}
            onClick={() => {
              setQuickFilter("all");
              setStatus("");
              setSeverity("");
              setSearch("");
            }}
          >
            <FontAwesomeIcon icon={faChartLine} /> Dashboard
          </button>
          <span className="nav-label">จัดการเคส</span>
          <button
            type="button"
            onClick={() => {
              setQuickFilter("all");
              setStatus("");
            }}
          >
            <FontAwesomeIcon icon={faFolderOpen} /> เคสทั้งหมด{" "}
            <b>{counts.all}</b>
          </button>
          <button
            type="button"
            className={quickFilter === "new" ? "active" : ""}
            onClick={() => {
              setQuickFilter("new");
              setStatus("");
            }}
          >
            <FontAwesomeIcon icon={faMessage} /> รับเรื่องแล้ว <b>{counts.new}</b>
          </button>
          <button
            type="button"
            className={quickFilter === "immediate" ? "danger active" : "danger"}
            onClick={() => {
              setQuickFilter("immediate");
              setStatus("");
            }}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} /> ตรวจสอบทันที{" "}
            <b>{counts.immediate}</b>
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/admin/students";
            }}
          >
            <FontAwesomeIcon icon={faUserGraduate} /> นักเรียน
          </button>
        </nav>
        <div className="sidebar-profile">
          <span>{(currentDisplayName || currentUsername || "บ").slice(0, 1)}</span>
          <div>
            <b>{currentDisplayName || currentUsername || "บัญชีบุคลากร"}</b>
            <small>{hasRole("SUPER_ADMIN") ? "แอดมินระบบ" : "บัญชีบุคลากร"}</small>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <small>วันทำการวันนี้</small>
            <b>
              {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(
                new Date(),
              )}
            </b>
          </div>
          <button
            aria-label="การแจ้งเตือน"
            onClick={() => setQuickFilter("immediate")}
          >
            <FontAwesomeIcon icon={faBell} />
            <span>{counts.immediate}</span>
          </button>
        </header>
        <section className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">ศูนย์ดูแลนักเรียน</span>
              <h1>สวัสดีครับ {currentDisplayName || currentUsername || "บุคลากร"}</h1>
              <p>ภาพรวมเคสและเรื่องที่ต้องให้ความสำคัญวันนี้</p>
            </div>
            <button className="button secondary" onClick={loadCases}>
              <FontAwesomeIcon icon={faRotate} /> รีเฟรช
            </button>
          </div>
          <div className="stat-grid">
            <Stat
              icon={faFolderOpen}
              label="เรื่องทั้งหมด"
              value={counts.all}
              tone="blue"
              active={quickFilter === "all"}
            />
            <Stat
              icon={faMessage}
              label="รับเรื่องแล้ว"
              value={counts.new}
              tone="cyan"
              active={quickFilter === "new"}
            />
            <Stat
              icon={faClock}
              label="รอพิจารณา / มอบหมาย"
              value={counts.pending}
              tone="amber"
              active={quickFilter === "pending"}
            />
            <Stat
              icon={faShieldHalved}
              label="กำลังดำเนินการ"
              value={counts.active}
              tone="orange"
              active={quickFilter === "active"}
            />
            <Stat
              icon={faMagnifyingGlass}
              label="รอตรวจผล / ปิด"
              value={counts.review}
              tone="purple"
              active={quickFilter === "review"}
            />
            <Stat
              icon={faCheckCircle}
              label="เสร็จสิ้น"
              value={counts.closed}
              tone="green"
              active={quickFilter === "closed"}
            />
          </div>
          <section className="case-panel">
            <div className="panel-heading">
              <div>
                <h2>รายการเคสล่าสุด</h2>
                <p>
                  เรียงจากยังไม่ได้ดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น
                  และเรียงรายการล่าสุดก่อนภายในแต่ละกลุ่ม
                </p>
              </div>
            </div>
            <div className="filter-bar">
              <label className="search-box">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา Case ID หรือหัวข้อ..."
                />
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="กรองสถานะ"
              >
                <option value="">ทุกสถานะ</option>
                {statusGroups.map((group) => (
                  <optgroup label={group.label} key={group.key}>
                    {group.statuses.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}
                  </optgroup>
                ))}
              </select>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                aria-label="กรองความสำคัญ"
              >
                <option value="">ทุกระดับ</option>
                {Object.entries(severityLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              {(status || severity || search) && (
                <button
                  className="clear-filter"
                  onClick={() => {
                    setStatus("");
                    setSeverity("");
                    setSearch("");
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} /> ล้างตัวกรอง
                </button>
              )}
            </div>
            {loading ? (
              <div className="table-skeleton">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faCircleInfo} />
                <h3>ไม่สามารถโหลดข้อมูลได้</h3>
                <p>{error}</p>
                <button className="button secondary" onClick={loadCases}>
                  ลองอีกครั้ง
                </button>
              </div>
            ) : visibleCases.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faBoxOpen} />
                <h3>ยังไม่มีเคสในรายการนี้</h3>
                <p>เมื่อมีเรื่องใหม่ รายการจะแสดงที่นี่</p>
              </div>
            ) : (
              <div className="case-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>วันที่แจ้ง</th>
                      <th>ประเภท</th>
                      <th>ความสำคัญ</th>
                      <th>สถานะ</th>
                      <th>ผู้แจ้ง</th>
                      <th></th>
                    </tr>
                  </thead>
                  {groupedVisibleCases.map((group) => (
                    <tbody key={group.key}>
                      <tr className={`case-group-row ${group.key}`}>
                        <td colSpan={7}><span>{group.label}</span><small>{group.cases.length} เคส</small></td>
                      </tr>
                      {group.cases.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.requires_immediate_review ? "immediate" : ""
                        }
                        onClick={() => openCase(item.case_number)}
                      >
                        <td className="case-id-cell">
                          <b>{item.case_number}</b>
                          <span className="case-list-title" title={item.title}>{item.title}</span>
                          {item.requires_immediate_review ? (
                            <small className="urgent-label">
                              <FontAwesomeIcon icon={faTriangleExclamation} />{" "}
                              ทันที
                            </small>
                          ) : null}
                          {["NEW", "REOPENED"].includes(item.status) && item.exclusive_reviewer_username === currentUsername ? (
                            <small className="exclusive-review-label"><FontAwesomeIcon icon={faLock} /> รอคุณพิจารณาเท่านั้น</small>
                          ) : null}
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>{item.category_name}</td>
                        <td>
                          <SeverityBadge value={item.severity} />
                        </td>
                        <td>
                          <StatusBadge value={item.status} />
                        </td>
                        <td>
                          <span className="case-reporter">
                            <b>{item.reporter_name}</b>
                            {item.level && item.classroom && <small>{item.level}/{item.classroom}</small>}
                          </span>
                        </td>
                        <td>
                          <FontAwesomeIcon icon={faChevronRight} />
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
      {selected && (
        <div
          className="case-modal-backdrop"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
        >
          <section className="case-detail-modal" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
            <header>
              <div>
                <small className="drawer-kicker">
                  <FontAwesomeIcon icon={faFolderOpen} />
                  รายละเอียดเคส
                </small>
                <h2 id="case-detail-title">{selected.case.case_number}</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="ปิด">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <div className="case-modal-body">
              <section className="case-summary-block">
              <div className="case-badges">
                <SeverityBadge value={String(selected.case.severity)} />
                <button
                  type="button"
                  className="status-jump-button"
                  title="ดูขั้นตอนดำเนินงาน"
                  onClick={() =>
                    document
                      .getElementById("case-workflow-actions")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  <StatusBadge value={String(selected.case.status)} />
                  <small>ดูขั้นตอนต่อไป</small>
                </button>
              </div>
              {["NEW", "REOPENED"].includes(String(selected.case.status)) && selected.case.exclusive_reviewer_username === currentUsername && (
                <div className="exclusive-review-notice"><FontAwesomeIcon icon={faLock} /><span><b>เคสจากห้องที่คุณเป็นครูที่ปรึกษา</b><small>ขณะนี้มีเพียงบัญชีของคุณที่เห็นเคสนี้ เมื่อส่งต่อแล้วผู้รับช่วงจึงจะเห็นตามสิทธิ์ปกติ</small></span></div>
              )}
              <h3 className="case-title">
                <FontAwesomeIcon icon={faMessage} />
                {selected.case.title}
              </h3>
              <p className="case-description">{selected.case.description}</p>
              </section>
              <div className="detail-grid">
                <Review
                  label="ประเภท"
                  value={String(selected.case.category_name)}
                />
                <Review
                  label="ความปลอดภัย"
                  value={
                    selected.case.safety_level === "UNSAFE"
                      ? "ไม่ปลอดภัย"
                      : selected.case.safety_level === "UNSURE"
                        ? "กังวล"
                        : "ปลอดภัย"
                  }
                />
                <Review
                  label="ผู้แจ้ง"
                  value={String(selected.case.reporter_name ?? `${selected.case.prefix ?? ""}${selected.case.first_name ?? ""} ${selected.case.last_name ?? ""}`.trim())}
                />
                <Review
                  label="ผู้รับผิดชอบ"
                    value={String(
                      selected.case.assigned_name ??
                        selected.case.assigned_to ??
                        "ยังไม่ได้มอบหมาย",
                    )}
                />
                <Review
                  label="ชั้น / ห้อง"
                  value={`${String(selected.case.level ?? "-")}/${String(selected.case.classroom ?? "-")}`}
                />
                <Review
                  label="ครูที่ปรึกษา"
                  value={
                    selected.case.advisor_names?.length
                      ? selected.case.advisor_names.join(" / ")
                      : "ยังไม่ได้กำหนดครูที่ปรึกษา"
                  }
                />
              </div>
              <div className="case-support-grid">
              {selected.assignments?.length > 0 && (
                <div className="note-card case-team-card">
                  <h4 className="section-title"><FontAwesomeIcon icon={faPeopleGroup} /> ทีมผู้ดำเนินการ</h4>
                  <div className="case-team-list">{selected.assignments.map((assignment) => (
                    <div key={assignment.id}><span><b>{assignment.display_name}</b><small>@{assignment.username}</small></span><em>{assignment.assignment_role === "LEAD" ? "ผู้รับผิดชอบหลัก" : "ผู้ร่วมดำเนินการ"}</em></div>
                  ))}</div>
                </div>
              )}
              <div className="note-card evidence-card">
                <h4 className="section-title">
                  <FontAwesomeIcon icon={faFileArrowUp} />
                  ไฟล์หลักฐาน
                </h4>
                {selected.attachments.length === 0 ? (
                  <p className="muted-text">ไม่ได้แนบหลักฐาน</p>
                ) : (
                  <div className="attachment-list">
                    {selected.attachments.map((file) => (
                      <button
                        type="button"
                        key={file.id}
                        onClick={() => setPreviewFile(file)}
                      >
                        <FontAwesomeIcon icon={faFileArrowUp} />
                        <span>{file.original_name}</span>
                        <small>
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              </div>
              <div className="action-card" id="case-workflow-actions">
                <h4 className="section-title">
                  <FontAwesomeIcon icon={faSliders} />
                  จัดการเคส
                </h4>
                <CaseWorkflowProgress status={String(selected.case.status)} />
                <div className="workflow-guidance">
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <div>
                    <b>
                      ขั้นตอนปัจจุบัน: {statusLabels[String(selected.case.status)]}
                    </b>
                    <small>
                      สรุปหรือเหตุผลที่กรอกตอนเปลี่ยนขั้นตอนจะแสดงในไทม์ไลน์
                      เพื่อบอกผู้รับช่วงว่าเกิดอะไรขึ้น ส่วนบันทึกภายในใช้จดข้อมูลระหว่างทำงาน
                    </small>
                  </div>
                </div>
                {availableStatusEntries(
                  String(selected.case.status),
                  currentRoles,
                  isCurrentAssignee || isTeamMember,
                  isCurrentAssignee,
                ).length > 1 ? (
                  <div className="workflow-next-step">
                    <FontAwesomeIcon icon={faArrowRight} />
                    <span>
                      <small>ขั้นตอนถัดไป</small>
                      <b>
                        {{
                          NEW: "คัดกรองและมอบหมายผู้รับผิดชอบ",
                          AFFAIRS_REVIEW: "ทีมกิจการพิจารณาและเลือกทีมครู",
                          DEPUTY_REVIEW: "รองผู้อำนวยการพิจารณา",
                          SCREENING: "เลือกผู้รับผิดชอบแล้วส่งต่อ",
                          ASSIGNED: "เริ่มดำเนินการเคส",
                          IN_PROGRESS: "ส่งผลการดำเนินงานให้แอดมินตรวจ",
                          INTAKE_REVIEW: "เจ้าหน้าที่ตรวจผลและปิดเคส",
                          ADMIN_REVIEW: "ตรวจผลแล้วปิดเคส หรือเสนอผู้อำนวยการ",
                          DIRECTOR_ORDERED: "รับคำสั่งผู้อำนวยการและดำเนินการต่อ",
                          PENDING_CLOSE: "ยืนยันปิดเคส",
                          RESOLVED: "ยืนยันปิดเคส",
                          CLOSED: "เปิดเคสอีกครั้ง",
                          REOPENED: "คัดกรองใหม่และมอบหมายผู้รับผิดชอบ",
                        }[String(selected.case.status)]}
                      </b>
                    </span>
                  </div>
                ) : (
                  <div className="workflow-waiting">
                    <FontAwesomeIcon icon={faClock} />
                    <span>
                      <small>ยังไม่มีรายการที่ต้องดำเนินการ</small>
                      <b>
                        {selected.case.status === "DIRECTOR_REVIEW"
                          ? "รอคำสั่งจากผู้อำนวยการ"
                          : selected.case.status === "CLOSED"
                            ? "เคสนี้ปิดเรียบร้อยแล้ว"
                            : "บัญชีนี้ไม่มีสิทธิ์ดำเนินการในขั้นตอนปัจจุบัน"}
                      </b>
                    </span>
                  </div>
                )}
                <label>
                  <span>
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    ระดับความสำคัญ
                  </span>
                  <select
                    value={selected.case.severity}
                    onChange={(e) => updateCase({ severity: e.target.value })}
                    disabled={saving || !["NEW", "REOPENED"].includes(String(selected.case.status)) || !(hasRole("SUPER_ADMIN") || hasRole("INTAKE"))}
                  >
                    {Object.entries(severityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <small className="field-help">{["NEW", "REOPENED"].includes(String(selected.case.status)) ? "เจ้าหน้าที่รับเรื่องกำหนดระดับก่อนส่งต่อ" : "ยืนยันแล้วและล็อกอัตโนมัติหลังส่งต่อเคส"}</small>
                </label>
                {["NEW", "REOPENED"].includes(String(selected.case.status)) && (hasRole("INTAKE") || hasRole("SUPER_ADMIN")) && (
                  <div className="workflow-decision-actions intake-routing-actions">
                    {!['SEVERE', 'CRITICAL'].includes(String(selected.case.severity)) && <button type="button" className="button primary" disabled={saving} onClick={() => setTransitionTarget("AFFAIRS_REVIEW")}><FontAwesomeIcon icon={faPeopleGroup} /> ส่งทีมกิจการนักเรียน</button>}
                    <button type="button" className={['SEVERE', 'CRITICAL'].includes(String(selected.case.severity)) ? "button primary" : "button secondary"} disabled={saving} onClick={() => setTransitionTarget("DEPUTY_REVIEW")}><FontAwesomeIcon icon={faShieldHalved} /> ส่งรองผู้อำนวยการ</button>
                    <button type="button" className="button secondary close-case-button" disabled={saving} onClick={() => setTransitionTarget("CLOSED")}><FontAwesomeIcon icon={faCheckCircle} /> พิจารณาแล้ว ปิดเคส</button>
                  </div>
                )}
                {selected.case.status === "AFFAIRS_REVIEW" && (hasRole("STUDENT_AFFAIRS") || hasRole("SUPER_ADMIN")) && (
                  <div className="affairs-review-panel">
                    <h5><FontAwesomeIcon icon={faPeopleGroup} /> เลือกทีมผู้ดำเนินการ</h5>
                    <TeamAssigneePicker selected={pendingTeam} lead={leadAssignee} disabled={saving} onChange={(team, lead) => { setPendingTeam(team); setLeadAssignee(lead); }} />
                    <div className="workflow-decision-actions">
                      <button type="button" className="button primary" disabled={saving || pendingTeam.length === 0 || !leadAssignee} onClick={() => setTransitionTarget("IN_PROGRESS")}><FontAwesomeIcon icon={faPaperPlane} /> อนุมัติและมอบหมาย</button>
                      <button type="button" className="button secondary" disabled={saving} onClick={() => setTransitionTarget("INTAKE_REVIEW")}><FontAwesomeIcon icon={faRotate} /> ไม่อนุมัติ ส่งกลับเจ้าหน้าที่</button>
                    </div>
                  </div>
                )}
                {selected.case.status === "IN_PROGRESS" && isCurrentAssignee && (
                  <button type="button" className="button primary wide workflow-submit" disabled={saving} onClick={() => setTransitionTarget("INTAKE_REVIEW")}><FontAwesomeIcon icon={faCheck} /> ทีมดำเนินการเรียบร้อย ส่งผลกลับเจ้าหน้าที่</button>
                )}
                {selected.case.status === "IN_PROGRESS" && isTeamMember && !isCurrentAssignee && (
                  <div className="workflow-waiting"><FontAwesomeIcon icon={faClock} /><span><small>คุณเป็นผู้ร่วมดำเนินการ</small><b>เพิ่มบันทึกผลได้ ผู้รับผิดชอบหลักเป็นผู้ส่งผลกลับเจ้าหน้าที่</b></span></div>
                )}
                {selected.case.status === "INTAKE_REVIEW" && (hasRole("INTAKE") || hasRole("SUPER_ADMIN")) && (
                  <div className="workflow-decision-actions">
                    <button type="button" className="button primary" disabled={saving} onClick={() => setTransitionTarget("CLOSED")}><FontAwesomeIcon icon={faCheckCircle} /> ตรวจผลแล้ว ปิดเคส</button>
                    {selected.assignments?.length > 0 && <button type="button" className="button secondary" disabled={saving} onClick={() => setTransitionTarget("IN_PROGRESS")}><FontAwesomeIcon icon={faRotate} /> ส่งกลับทีมเดิมดำเนินการต่อ</button>}
                  </div>
                )}
                {["DEPUTY_REVIEW", "DIRECTOR_REVIEW"].includes(String(selected.case.status)) && (
                  <div className="workflow-waiting"><FontAwesomeIcon icon={faClock} /><span><small>อยู่ระหว่างการพิจารณา</small><b>{selected.case.status === "DEPUTY_REVIEW" ? "รอรองผู้อำนวยการดำเนินการในพอร์ทัลฝ่ายบริหาร" : "รอผู้อำนวยการดำเนินการในพอร์ทัลฝ่ายบริหาร"}</b></span></div>
                )}
                {canChooseAssignee && (
                  <label className="assignee-field">
                    <span>
                      <FontAwesomeIcon icon={faUserShield} />
                      1. เลือกครูหรือเจ้าหน้าที่ผู้รับผิดชอบ (เคสเดิม)
                    </span>
                    <AssigneeCombobox
                      key={String(selected.case.assigned_to ?? "unassigned")}
                      currentUsername={String(selected.case.assigned_to ?? "")}
                      disabled={saving}
                      onSelect={(username, displayName) => {
                        setPendingAssignee(username);
                        setPendingAssigneeName(displayName);
                      }}
                    />
                  </label>
                )}
                {selected.case.status === "SCREENING" &&
                  (hasRole("SUPER_ADMIN") || hasRole("INTAKE")) && (
                    <>
                      <button
                        type="button"
                        className="button primary wide workflow-submit"
                        disabled={saving || !pendingAssignee}
                        onClick={() => setTransitionTarget("ASSIGNED")}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                        {pendingAssigneeName
                          ? `2. คัดกรองและมอบหมายให้ ${pendingAssigneeName}`
                          : "2. เลือกผู้รับผิดชอบก่อนส่งต่อ"}
                      </button>
                      {hasRole("SUPER_ADMIN") && currentUsername && (
                        <button
                          type="button"
                          className="button secondary wide workflow-submit admin-self-assign"
                          disabled={saving}
                          onClick={() => {
                            setPendingAssignee(currentUsername);
                            setPendingAssigneeName(currentDisplayName);
                            setTransitionTarget("ASSIGNED");
                          }}
                        >
                          <FontAwesomeIcon icon={faUserShield} />
                          หรือให้แอดมินระบบรับดำเนินการเอง
                        </button>
                      )}
                    </>
                )}
                {selected.case.status === "ASSIGNED" &&
                  (isCurrentAssignee || isTeamMember || hasRole("SUPER_ADMIN")) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit"
                      disabled={saving}
                      onClick={() => setTransitionTarget("IN_PROGRESS")}
                    >
                      <FontAwesomeIcon icon={faArrowRight} /> เริ่มดำเนินการเคส
                    </button>
                  )}
                {selected.case.status === "DIRECTOR_ORDERED" &&
                  (isCurrentAssignee || isTeamMember || hasRole("SUPER_ADMIN")) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit"
                      disabled={saving}
                      onClick={() => setTransitionTarget("IN_PROGRESS")}
                    >
                      <FontAwesomeIcon icon={faArrowRight} /> รับคำสั่งและดำเนินการต่อ
                    </button>
                  )}
                {selected.case.status === "ADMIN_REVIEW" &&
                  (hasRole("SUPER_ADMIN") || hasRole("INTAKE")) && (
                    <div className="workflow-decision-actions">
                      <button
                        type="button"
                        className="button primary"
                        disabled={saving}
                        onClick={() => setTransitionTarget("CLOSED")}
                      >
                        <FontAwesomeIcon icon={faCheck} /> ตรวจผลแล้ว ปิดเคส
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={saving}
                        onClick={() => setTransitionTarget("DIRECTOR_REVIEW")}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} /> เสนอผู้อำนวยการ
                      </button>
                    </div>
                  )}
                {selected.case.status === "PENDING_CLOSE" &&
                  (hasRole("SUPER_ADMIN") || hasRole("INTAKE")) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit close-case-button"
                      disabled={saving}
                      onClick={() => setTransitionTarget("CLOSED")}
                    >
                      <FontAwesomeIcon icon={faCheck} /> ยืนยันปิดเคส
                    </button>
                  )}
                {selected.case.status === "RESOLVED" &&
                  availableStatusEntries("RESOLVED", currentRoles).some(
                    ([value]) => value === "CLOSED",
                  ) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit close-case-button"
                      disabled={saving}
                      onClick={() => setTransitionTarget("CLOSED")}
                    >
                      <FontAwesomeIcon icon={faCheck} /> ยืนยันปิดเคส
                    </button>
                  )}
                {hasRole("SUPER_ADMIN") &&
                  !(isCurrentAssignee && selected.case.status === "IN_PROGRESS") &&
                  !["PENDING_CLOSE", "RESOLVED", "CLOSED"].includes(selected.case.status) && (
                    <div className="direct-close-action">
                      <span>
                        <b>ปิดเคสโดยแอดมิน</b>
                        <small>ข้ามขั้นตอนที่เหลือ และเพิ่มสรุปประกอบได้หากต้องการ</small>
                      </span>
                      <button
                        type="button"
                        className="button secondary direct-close-button"
                        disabled={saving}
                        onClick={() => setTransitionTarget("CLOSED")}
                      >
                        <FontAwesomeIcon icon={faCheckCircle} /> ปิดเคสทันที
                      </button>
                    </div>
                  )}
                {selected.case.status === "CLOSED" &&
                  availableStatusEntries("CLOSED", currentRoles).some(
                    ([value]) => value === "REOPENED",
                  ) && (
                    <button
                      type="button"
                      className="button secondary wide workflow-submit"
                      disabled={saving}
                      onClick={() => setTransitionTarget("REOPENED")}
                    >
                      <FontAwesomeIcon icon={faRotate} /> เปิดเคสอีกครั้ง
                    </button>
                  )}
              </div>
              <div className="case-history-grid">
              <div className="note-card internal-note-card">
                <div className="note-card-heading">
                  <h4 className="section-title">
                    <FontAwesomeIcon icon={faMessage} />
                    บันทึกภายใน
                  </h4>
                  {!noteEditorOpen && (
                    <button
                      type="button"
                      className="note-toggle-button"
                      onClick={() => {
                        setEditingNoteId(null);
                        setNote("");
                        setNoteEditorOpen(true);
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} /> เพิ่มบันทึก
                    </button>
                  )}
                </div>
                <p className="internal-note-help">ใช้จดข้อมูลประกอบระหว่างดำเนินงาน ไม่เปลี่ยนสถานะและไม่ใช่คำสั่งส่งต่อ</p>
                {noteEditorOpen && (
                  <div className="note-composer">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="เพิ่มบันทึกสำหรับเจ้าหน้าที่..."
                      autoFocus
                    />
                    <div className="note-composer-actions">
                      <button
                        type="button"
                        className="button secondary compact"
                        disabled={saving}
                        onClick={() => {
                          setNote("");
                          setEditingNoteId(null);
                          setNoteEditorOpen(false);
                        }}
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        className="button primary compact"
                        disabled={saving || note.trim().length < 2}
                        onClick={() =>
                          updateCase(
                            editingNoteId
                              ? { note, noteId: editingNoteId }
                              : { note },
                          )
                        }
                      >
                        {saving ? (
                          <>
                            <span className="spinner" /> กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCheck} />{" "}
                            {editingNoteId ? "บันทึกการแก้ไข" : "บันทึก"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {selected.notes.length === 0 && !noteEditorOpen ? (
                  <p className="muted-text note-empty">ยังไม่มีบันทึกภายใน</p>
                ) : (
                  selected.notes.map((item) => (
                    <div className="note-item" key={item.id}>
                      <div className="note-item-head">
                        <small>
                          {item.created_by} · {formatDate(item.created_at)}
                        </small>
                        {item.is_editable ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setEditingNoteId(item.id);
                              setNote(item.note);
                              setNoteEditorOpen(true);
                            }}
                            aria-label={"แก้ไขบันทึกของ " + item.created_by}
                          >
                            <FontAwesomeIcon icon={faPen} /> แก้ไข
                          </button>
                        ) : (
                          <span className="note-locked">
                            <FontAwesomeIcon icon={faCheckCircle} /> ล็อกแล้ว
                          </span>
                        )}
                      </div>
                      <p>{item.note}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="timeline-card">
                <h4 className="section-title">
                  <FontAwesomeIcon icon={faClock} />
                  ลำดับการดำเนินงาน
                </h4>
                {selected.timeline.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <span />
                    <div>
                      <b>{item.title}</b>
                      {item.description && <p>{item.description}</p>}
                      <small>
                        {formatDate(item.created_at)} · {item.created_by}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
              </div>
              {hasRole("SUPER_ADMIN") && (
                <section className="admin-tools-card">
                  <header>
                    <span>
                      <FontAwesomeIcon icon={faShieldHalved} />
                    </span>
                    <div>
                      <h4>เครื่องมือผู้ดูแลระบบ</h4>
                      <p>คำสั่งพิเศษสำหรับดูแลเคส ไม่เกี่ยวกับขั้นตอนดำเนินงาน</p>
                    </div>
                  </header>
                  <div className="admin-tool-row danger-zone">
                    <div>
                      <b>ลบเคสออกจากระบบ</b>
                      <small>ลบข้อมูลและไฟล์หลักฐานถาวร ไม่สามารถย้อนกลับได้</small>
                    </div>
                    <button
                      type="button"
                      className="button danger-button compact"
                      onClick={() => setDeleteCaseOpen(true)}
                    >
                      <FontAwesomeIcon icon={faTrashCan} /> ลบเคส
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      )}
      {selected && deleteCaseOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setDeleteCaseOpen(false);
          }}
        >
          <section
            className="student-confirm-modal case-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="case-delete-title"
          >
            <span className="danger">
              <FontAwesomeIcon icon={faTrashCan} />
            </span>
            <h2 id="case-delete-title">ยืนยันการลบเคส</h2>
            <p>
              การลบจะนำรายละเอียด บันทึก Timeline และไฟล์หลักฐานของเคสนี้ออกถาวร
              ไม่สามารถย้อนกลับได้
            </p>
            <div className="student-confirm-person">
              <small>เคสที่จะลบ</small>
              <b>{selected.case.case_number}</b>
              <span>{selected.case.title}</span>
            </div>
            <div className="student-confirm-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDeleteCaseOpen(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="button danger-button"
                onClick={deleteCase}
                disabled={saving}
              >
                <FontAwesomeIcon icon={faTrashCan} />{" "}
                {saving ? "กำลังลบ..." : "ลบเคสถาวร"}
              </button>
            </div>
          </section>
        </div>
      )}
      <EvidencePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
      {selected && transitionTarget && (
        <WorkflowTransitionModal
          fromLabel={
            statusLabels[String(selected.case.status)] ??
            String(selected.case.status)
          }
          toLabel={statusLabels[transitionTarget] ?? transitionTarget}
          recipientLabel={
            transitionTarget === "IN_PROGRESS" && selected.case.status === "AFFAIRS_REVIEW"
              ? `ทีมผู้ดำเนินการ ${pendingTeam.length} คน`
              : transitionTarget === "ASSIGNED" ? pendingAssigneeName : undefined
          }
          closing={transitionTarget === "CLOSED"}
          saving={saving}
          onClose={() => setTransitionTarget("")}
          onConfirm={(handoffReason, dueDate) =>
            updateCase({
              status: transitionTarget,
              ...(handoffReason.trim() ? { handoffReason } : {}),
              ...(transitionTarget === "ASSIGNED" && pendingAssignee
                ? { assignedTo: pendingAssignee }
                : {}),
              ...(transitionTarget === "IN_PROGRESS" && selected.case.status === "AFFAIRS_REVIEW"
                ? { assignees: pendingTeam, leadAssignee }
                : {}),
              ...(dueDate ? { dueDate } : {}),
            })
          }
        />
      )}
      {selected && reassignmentOpen && pendingAssignee && (
        <WorkflowTransitionModal
          fromLabel={String(selected.case.assigned_name ?? selected.case.assigned_to ?? "ผู้รับผิดชอบเดิม")}
          toLabel={pendingAssigneeName || pendingAssignee}
          recipientLabel={pendingAssigneeName || pendingAssignee}
          reassignment
          saving={saving}
          onClose={() => setReassignmentOpen(false)}
          onConfirm={(handoffReason, dueDate) =>
            updateCase({
              assignedTo: pendingAssignee,
              ...(handoffReason.trim() ? { handoffReason } : {}),
              ...(dueDate ? { dueDate } : {}),
            })
          }
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  active,
}: {
  icon: typeof faFolderOpen;
  label: string;
  value: number;
  tone: string;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`stat-card tone-${tone}${active ? " active" : ""}`}
      aria-pressed={active}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("redbox-filter", { detail: label }),
        )
      }
    >
      <span>
        <FontAwesomeIcon icon={icon} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      <FontAwesomeIcon className="stat-arrow" icon={faChevronRight} />
    </button>
  );
}
function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value.endsWith("Z") ? value : `${value}Z`));
  } catch {
    return value;
  }
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="footer-developer">
          <FontAwesomeIcon icon={faCode} />
          <strong>Chonnatee Boonta</strong>
        </div>
        <div className="footer-bottom">
          <span className="footer-copyright">
            <FontAwesomeIcon icon={faCopyright} /> 2569 โรงเรียนจอมทอง
            สงวนลิขสิทธิ์
          </span>
          <span className="footer-powered">Powered by</span>
          <div className="footer-tech" aria-label="เทคโนโลยีที่ใช้">
            <span className="tech-next" title="Next.js" aria-label="Next.js">
              <SiNextdotjs />
            </span>
            <span
              className="tech-cloudflare"
              title="Cloudflare Workers"
              aria-label="Cloudflare Workers"
            >
              <SiCloudflare />
            </span>
            <span
              className="tech-typescript"
              title="TypeScript"
              aria-label="TypeScript"
            >
              <SiTypescript />
            </span>
            <span
              className="tech-database"
              title="Cloudflare D1"
              aria-label="Cloudflare D1"
            >
              <FontAwesomeIcon icon={faDatabase} />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
