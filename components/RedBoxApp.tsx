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
} from "@fortawesome/free-solid-svg-icons";
import { SiCloudflare, SiNextdotjs, SiTypescript } from "react-icons/si";
import type { CaseRecord, Student } from "../lib/types";
import { SeverityBadge, StatusBadge } from "./CaseBadge";
import { EvidencePreview } from "./EvidencePreview";
import { WorkflowTransitionModal } from "./WorkflowTransitionModal";

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
  case: CaseRecord & Record<string, string | number | null>;
  timeline: Timeline[];
  notes: Note[];
  attachments: Attachment[];
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
  faHeart,
  faShieldHalved,
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
const severityLabels: Record<string, string> = {
  GENERAL: "ทั่วไป",
  CONCERN: "ควรติดตาม",
  SERIOUS: "ร้ายแรง",
  CRITICAL: "เร่งด่วน",
};

function availableStatusEntries(current: string, role: string) {
  const edges: Record<string, string[]> = {
    NEW: ["SCREENING"],
    SCREENING: ["ASSIGNED"],
    ASSIGNED: ["IN_PROGRESS"],
    IN_PROGRESS: ["ADMIN_REVIEW"],
    ADMIN_REVIEW: ["DIRECTOR_REVIEW", "PENDING_CLOSE"],
    DIRECTOR_ORDERED: ["IN_PROGRESS"],
    PENDING_CLOSE: ["CLOSED"],
    RESOLVED: ["CLOSED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["SCREENING"],
  };
  const roleEdges: Record<string, string[]> = {
    INTAKE: [
      "NEW>SCREENING",
      "SCREENING>ASSIGNED",
      "ADMIN_REVIEW>DIRECTOR_REVIEW",
      "ADMIN_REVIEW>PENDING_CLOSE",
      "PENDING_CLOSE>CLOSED",
      "RESOLVED>CLOSED",
      "REOPENED>SCREENING",
    ],
    CASE_OFFICER: [
      "ASSIGNED>IN_PROGRESS",
      "IN_PROGRESS>ADMIN_REVIEW",
      "DIRECTOR_ORDERED>IN_PROGRESS",
    ],
    ADVISOR: [
      "ASSIGNED>IN_PROGRESS",
      "IN_PROGRESS>ADMIN_REVIEW",
      "DIRECTOR_ORDERED>IN_PROGRESS",
    ],
  };
  const next = (edges[current] ?? []).filter(
    (status) =>
      role === "SUPER_ADMIN" ||
      roleEdges[role]?.includes(`${current}>${status}`),
  );
  return [current, ...next].map(
    (status) => [status, statusLabels[status] ?? status] as const,
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

function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/" className="brand" aria-label="กล่องแดง หน้าแรก">
        <img
          className="school-logo"
          src="/images/chomthong-logo.png"
          width={50}
          height={50}
          alt="ตราโรงเรียนจอมทอง"
        />
        <span>
          <strong>กล่องแดง</strong>
          <small>RED BOX · โรงเรียนจอมทอง</small>
        </span>
      </Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/track">
          <FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะ
        </Link>
        <Link href="/report" className="button primary compact">
          <FontAwesomeIcon icon={faMessage} /> แจ้งเรื่อง
        </Link>
        <Link
          href="/admin/login"
          className="button secondary compact icon-button"
          aria-label="เข้าสู่ระบบสำหรับเจ้าหน้าที่"
          title="สำหรับเจ้าหน้าที่"
        >
          <FontAwesomeIcon icon={faUserShield} />
        </Link>
      </nav>
    </header>
  );
}

function HomeContent() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="safe-pill">
            <FontAwesomeIcon icon={faShieldHalved} />{" "}
            พื้นที่ปลอดภัยสำหรับนักเรียน
          </span>
          <h1>
            ทุกเรื่องที่อยากเล่า
            <br />
            <em>มีความหมาย</em>
          </h1>
          <p className="hero-lead">
            มีเรื่องไม่สบายใจ เจอปัญหา หรืออยากให้โรงเรียนช่วย บอกเราได้ที่นี่
          </p>
          <div className="hero-actions">
            <Link href="/report" className="button primary large">
              <FontAwesomeIcon icon={faMessage} /> แจ้งปัญหา / ขอความช่วยเหลือ
            </Link>
            <Link href="/track" className="button secondary large">
              <FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะเรื่อง
            </Link>
          </div>
          <div className="trust-row">
            <span>
              <FontAwesomeIcon icon={faCheckCircle} /> เลือกปกปิดตัวตนได้
            </span>
            <span>
              <FontAwesomeIcon icon={faCheckCircle} /> ข้อมูลได้รับการดูแล
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="glow one" />
          <div className="glow two" />
          <div className="message-card card-one">
            <FontAwesomeIcon icon={faHeart} />
            <span>
              เราอยู่ตรงนี้
              <br />
              <b>พร้อมรับฟังเสมอ</b>
            </span>
          </div>
          <div className="red-box">
            <div className="box-slot" />
            <FontAwesomeIcon icon={faMessage} />
          </div>
          <div className="message-card card-two">
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>
              <b>ปลอดภัย</b>
              <br />
              และเป็นความลับ
            </span>
          </div>
        </div>
      </section>

      <section className="category-section">
        <div className="section-heading">
          <span>บอกเราได้ทุกเรื่อง</span>
          <h2>เรื่องไหนที่อยากให้เราช่วย?</h2>
          <p>เลือกหัวข้อที่ใกล้เคียงที่สุด ไม่ต้องกังวลว่าจะเลือกผิด</p>
        </div>
        <div className="category-grid">
          {categoryFallbacks.map((category, index) => (
            <Link
              href="/report"
              key={category.id}
              className={`category-card tone-${category.color}`}
            >
              <span className="category-icon">
                <FontAwesomeIcon icon={categoryIcons[index]} />
              </span>
              <strong>{category.name}</strong>
              <FontAwesomeIcon
                className="category-arrow"
                icon={faChevronRight}
              />
            </Link>
          ))}
        </div>
      </section>

      <section className="promise-section">
        <div>
          <span className="eyebrow">คำสัญญาจากเรา</span>
          <h2>ไม่ต้องรับมือกับเรื่องนี้เพียงลำพัง</h2>
        </div>
        <div className="promise-grid">
          <article>
            <FontAwesomeIcon icon={faPeopleGroup} />
            <h3>มีคนรับฟัง</h3>
            <p>เจ้าหน้าที่ที่เหมาะสมจะรับฟังและช่วยดูแลอย่างตั้งใจ</p>
          </article>
          <article>
            <FontAwesomeIcon icon={faShieldHalved} />
            <h3>เคารพความเป็นส่วนตัว</h3>
            <p>เลือกปกปิดชื่อจากเจ้าหน้าที่ทั่วไปได้</p>
          </article>
          <article>
            <FontAwesomeIcon icon={faClock} />
            <h3>ติดตามได้</h3>
            <p>ใช้หมายเลขเคสตรวจสอบความคืบหน้าได้ทุกเวลา</p>
          </article>
        </div>
      </section>
    </main>
  );
}

function ReportWizard({ notify }: { notify: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const formTopRef = useRef<HTMLElement | null>(null);
  const hasChangedStep = useRef(false);
  const [studentCode, setStudentCode] = useState("");
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
        /^\d{6}$/.test(trackingPassword) &&
        trackingPassword === trackingPasswordConfirm
      );
    if (step === 2) return Boolean(form.categoryId);
    if (step === 3)
      return (
        form.title.trim().length >= 5 && form.description.trim().length >= 10
      );
    return true;
  }

  async function submitReport() {
    if (!student || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          studentId: student.id,
          trackingPassword,
          idempotencyKey: crypto.randomUUID(),
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
                  <div className="tracking-password-box">
                    <div>
                      <FontAwesomeIcon icon={faShieldHalved} />
                      <span>
                        <b>ตั้งรหัสสำหรับเรื่องนี้</b>
                        <small>
                          ทุกเรื่องใช้รหัส 6 หลักแยกกัน
                          ตั้งรหัสใหม่ได้ทุกครั้งที่ส่ง
                        </small>
                      </span>
                    </div>
                    <label>
                      <span>รหัสติดตาม 6 หลัก</span>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={trackingPassword}
                        onChange={(e) =>
                          setTrackingPassword(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        maxLength={6}
                        placeholder="••••••"
                      />
                    </label>
                    <label>
                      <span>ยืนยันรหัสอีกครั้ง</span>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={trackingPasswordConfirm}
                        onChange={(e) =>
                          setTrackingPasswordConfirm(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        maxLength={6}
                        placeholder="••••••"
                      />
                    </label>
                    {trackingPasswordConfirm &&
                      trackingPassword !== trackingPasswordConfirm && (
                        <small className="password-mismatch">
                          รหัสทั้งสองช่องยังไม่ตรงกัน
                        </small>
                      )}
                  </div>
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
                      ให้ติดต่อครูที่อยู่ใกล้ที่สุดหรือโทร 191
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
                disabled={loading}
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
  const [trackingPassword, setTrackingPassword] = useState("");
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
      const response = await fetch(
        `/api/cases?studentCode=${encodeURIComponent(studentCode)}&trackingPassword=${encodeURIComponent(trackingPassword)}`,
      );
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
            ใช้เลขประจำตัวนักเรียนและรหัสติดตาม 6 หลักที่ตั้งไว้ตอนส่งเรื่อง
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
              <span>รหัสติดตาม 6 หลัก</span>
              <input
                type="password"
                value={trackingPassword}
                inputMode="numeric"
                autoComplete="current-password"
                onChange={(e) => {
                  setTrackingPassword(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  );
                  setSearched(false);
                }}
                placeholder="••••••"
                maxLength={6}
              />
            </label>
            <button
              className="button primary"
              disabled={
                loading ||
                studentCode.length < 4 ||
                trackingPassword.length !== 6
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
    role: "CASE_OFFICER" | "ADVISOR";
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
                    {item.role === "ADVISOR"
                      ? "ครูที่ปรึกษา"
                      : "ผู้รับผิดชอบเคส"}{" "}
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

function AdminDashboard({ notify }: { notify: (message: string) => void }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [quickFilter, setQuickFilter] = useState<
    "all" | "new" | "immediate" | "closed"
  >("all");
  const [selected, setSelected] = useState<Detail | null>(null);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [transitionTarget, setTransitionTarget] = useState("");
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [deleteCaseOpen, setDeleteCaseOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [pendingAssignee, setPendingAssignee] = useState("");
  const [pendingAssigneeName, setPendingAssigneeName] = useState("");
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
        label === "เคสใหม่"
          ? "new"
          : label === "ตรวจสอบทันที"
            ? "immediate"
            : label === "สำเร็จ / ปิดแล้ว"
              ? "closed"
              : "all",
      );
      setStatus(label === "กำลังดำเนินการ" ? "IN_PROGRESS" : "");
      setSeverity(label === "Critical" ? "CRITICAL" : "");
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
            user?: { role?: string; username?: string; displayName?: string };
          },
      )
      .then((data) => {
        setCurrentRole(data.user?.role ?? "");
        setCurrentUsername(data.user?.username ?? "");
        setCurrentDisplayName(
          data.user?.displayName ?? data.user?.username ?? "ผู้ดูแลระบบ",
        );
      })
      .catch(() => undefined);
  }, []);
  async function openCase(caseNumber: string) {
    try {
      const response = await fetch(`/api/cases/${caseNumber}`);
      const data = await readJson<Detail & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      setNote("");
      setNoteEditorOpen(false);
      setEditingNoteId(null);
      setPendingAssignee(String(data.case.assigned_to ?? ""));
      setPendingAssigneeName(
        String(data.case.assigned_name ?? data.case.assigned_to ?? ""),
      );
      setSelected(data);
    } catch {
      notify("ไม่สามารถโหลดรายละเอียดเคสได้");
    }
  }
  async function updateCase(payload: Record<string, string>) {
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
      await loadCases();
      await openCase(selected.case.case_number);
    } catch (e) {
      notify(e instanceof Error ? e.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
    }
  }
  async function deleteCase() {
    if (!selected || currentRole !== "SUPER_ADMIN") return;
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
      new: cases.filter((c) => c.status === "NEW").length,
      immediate: cases.filter((c) => c.requires_immediate_review).length,
      critical: cases.filter((c) => c.severity === "CRITICAL").length,
      progress: cases.filter((c) => c.status === "IN_PROGRESS").length,
      closed: cases.filter((c) => ["RESOLVED", "CLOSED"].includes(c.status))
        .length,
    }),
    [cases],
  );
  const visibleCases =
    quickFilter === "new"
      ? cases.filter((item) => item.status === "NEW")
      : quickFilter === "immediate"
        ? cases.filter((item) => item.requires_immediate_review)
        : quickFilter === "closed"
          ? cases.filter((item) => ["RESOLVED", "CLOSED"].includes(item.status))
          : cases;
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
            <FontAwesomeIcon icon={faMessage} /> เคสใหม่ <b>{counts.new}</b>
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
          <span>ผ</span>
          <div>
            <b>ผู้ดูแลระบบ</b>
            <small>ADMIN</small>
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
              <h1>สวัสดีครับ ผู้ดูแลระบบ</h1>
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
            />
            <Stat
              icon={faMessage}
              label="เคสใหม่"
              value={counts.new}
              tone="cyan"
            />
            <Stat
              icon={faTriangleExclamation}
              label="ตรวจสอบทันที"
              value={counts.immediate}
              tone="red"
            />
            <Stat
              icon={faClock}
              label="กำลังดำเนินการ"
              value={counts.progress}
              tone="amber"
            />
            <Stat
              icon={faShieldHalved}
              label="Critical"
              value={counts.critical}
              tone="orange"
            />
            <Stat
              icon={faCheckCircle}
              label="สำเร็จ / ปิดแล้ว"
              value={counts.closed}
              tone="green"
            />
          </div>
          <section className="case-panel">
            <div className="panel-heading">
              <div>
                <h2>รายการเคสล่าสุด</h2>
                <p>ค้นหา คัดกรอง และเปิดดูรายละเอียดได้ทันที</p>
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
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
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
                  <tbody>
                    {visibleCases.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.requires_immediate_review ? "immediate" : ""
                        }
                        onClick={() => openCase(item.case_number)}
                      >
                        <td>
                          <b>{item.case_number}</b>
                          {item.requires_immediate_review ? (
                            <small className="urgent-label">
                              <FontAwesomeIcon icon={faTriangleExclamation} />{" "}
                              ทันที
                            </small>
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
                        <td>{item.reporter_name}</td>
                        <td>
                          <FontAwesomeIcon icon={faChevronRight} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
      {selected && (
        <div
          className="drawer-backdrop"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
        >
          <aside className="case-drawer">
            <header>
              <div>
                <small className="drawer-kicker">
                  <FontAwesomeIcon icon={faFolderOpen} />
                  รายละเอียดเคส
                </small>
                <h2>{selected.case.case_number}</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="ปิด">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <div className="drawer-body">
              <div className="case-badges">
                <SeverityBadge value={String(selected.case.severity)} />
                <StatusBadge value={String(selected.case.status)} />
              </div>
              <h3 className="case-title">
                <FontAwesomeIcon icon={faMessage} />
                {selected.case.title}
              </h3>
              <p className="case-description">{selected.case.description}</p>
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
                  value={
                    selected.case.is_anonymous
                      ? "ปกปิดตัวตน"
                      : `${selected.case.prefix}${selected.case.first_name} ${selected.case.last_name}`
                  }
                />
                <Review
                  label="ผู้รับผิดชอบ"
                    value={String(
                      selected.case.assigned_name ??
                        selected.case.assigned_to ??
                        "ยังไม่ได้มอบหมาย",
                    )}
                />
              </div>
              <div className="note-card">
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
              <div className="action-card">
                <h4 className="section-title">
                  <FontAwesomeIcon icon={faSliders} />
                  จัดการเคส
                </h4>
                <div className="workflow-guidance">
                  <FontAwesomeIcon icon={faShieldHalved} />
                  <div>
                    <b>
                      ขั้นตอนปัจจุบัน: {statusLabels[String(selected.case.status)]}
                    </b>
                    <small>
                      คำสั่งและเหตุผลที่กรอกตอนส่งต่อเป็นบันทึกภายใน
                      เฉพาะเจ้าหน้าที่และครูที่เกี่ยวข้องเท่านั้นที่เห็น
                      นักเรียนจะไม่เห็นข้อความนี้
                    </small>
                  </div>
                </div>
                {["SCREENING", "ASSIGNED", "IN_PROGRESS", "ADMIN_REVIEW", "PENDING_CLOSE"].includes(
                  String(selected.case.status),
                ) &&
                availableStatusEntries(
                  String(selected.case.status),
                  currentRole,
                ).length > 1 ? (
                  <div className="workflow-next-step">
                    <FontAwesomeIcon icon={faArrowRight} />
                    <span>
                      <small>ขั้นตอนถัดไป</small>
                      <b>
                        {{
                          SCREENING: "เลือกผู้รับผิดชอบแล้วส่งต่อ",
                          ASSIGNED: "เริ่มดำเนินการเคส",
                          IN_PROGRESS: "ส่งผลการดำเนินงานให้แอดมินตรวจ",
                          ADMIN_REVIEW: "ตรวจผลแล้วเลือกปิดเคสหรือเสนอผู้อำนวยการ",
                          PENDING_CLOSE: "ยืนยันปิดเคส",
                        }[String(selected.case.status)]}
                      </b>
                    </span>
                  </div>
                ) : (
                  <label>
                    <span>
                      <FontAwesomeIcon icon={faClock} />
                      เปลี่ยนไปขั้นตอนถัดไป
                    </span>
                    <select
                      value={selected.case.status}
                      onChange={(e) => {
                        if (e.target.value !== selected.case.status)
                          setTransitionTarget(e.target.value);
                      }}
                      disabled={saving || !currentRole}
                    >
                      {availableStatusEntries(
                        String(selected.case.status),
                        currentRole,
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  <span>
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    ระดับความสำคัญ
                  </span>
                  <select
                    value={selected.case.severity}
                    onChange={(e) => updateCase({ severity: e.target.value })}
                    disabled={
                      saving || !["SUPER_ADMIN", "INTAKE"].includes(currentRole)
                    }
                  >
                    {Object.entries(severityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {["SUPER_ADMIN", "INTAKE"].includes(currentRole) && (
                  <label className="assignee-field">
                    <span>
                      <FontAwesomeIcon icon={faUserShield} />
                      {selected.case.status === "SCREENING"
                        ? "1. เลือกครูหรือเจ้าหน้าที่ผู้รับผิดชอบ"
                        : "ผู้รับผิดชอบเคส"}
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
                  ["SUPER_ADMIN", "INTAKE"].includes(currentRole) && (
                    <>
                      <button
                        type="button"
                        className="button primary wide workflow-submit"
                        disabled={saving || !pendingAssignee}
                        onClick={() => setTransitionTarget("ASSIGNED")}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                        {pendingAssigneeName
                          ? `2. มอบหมายและส่งต่อให้ ${pendingAssigneeName}`
                          : "2. เลือกผู้รับผิดชอบก่อนส่งต่อ"}
                      </button>
                      {currentRole === "SUPER_ADMIN" && currentUsername && (
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
                {selected.case.status !== "SCREENING" &&
                  ["SUPER_ADMIN", "INTAKE"].includes(currentRole) &&
                  pendingAssignee &&
                  pendingAssignee !== String(selected.case.assigned_to ?? "") && (
                    <button
                      type="button"
                      className="button secondary wide workflow-submit"
                      disabled={saving}
                      onClick={() => updateCase({ assignedTo: pendingAssignee })}
                    >
                      <FontAwesomeIcon icon={faCheck} /> บันทึกผู้รับผิดชอบ
                    </button>
                  )}
                {selected.case.status === "ASSIGNED" &&
                  availableStatusEntries("ASSIGNED", currentRole).some(
                    ([value]) => value === "IN_PROGRESS",
                  ) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit"
                      disabled={saving}
                      onClick={() => setTransitionTarget("IN_PROGRESS")}
                    >
                      <FontAwesomeIcon icon={faArrowRight} /> เริ่มดำเนินการเคส
                    </button>
                  )}
                {selected.case.status === "IN_PROGRESS" &&
                  availableStatusEntries("IN_PROGRESS", currentRole).some(
                    ([value]) => value === "ADMIN_REVIEW",
                  ) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit"
                      disabled={saving}
                      onClick={() => setTransitionTarget("ADMIN_REVIEW")}
                    >
                      <FontAwesomeIcon icon={faCheck} /> ดำเนินการเสร็จแล้ว
                      ส่งผลให้แอดมินตรวจ
                    </button>
                  )}
                {selected.case.status === "ADMIN_REVIEW" &&
                  ["SUPER_ADMIN", "INTAKE"].includes(currentRole) && (
                    <div className="workflow-decision-actions">
                      <button
                        type="button"
                        className="button primary"
                        disabled={saving}
                        onClick={() => setTransitionTarget("PENDING_CLOSE")}
                      >
                        <FontAwesomeIcon icon={faCheck} /> ผลเรียบร้อย เตรียมปิดเคส
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
                  ["SUPER_ADMIN", "INTAKE"].includes(currentRole) && (
                    <button
                      type="button"
                      className="button primary wide workflow-submit close-case-button"
                      disabled={saving}
                      onClick={() => setTransitionTarget("CLOSED")}
                    >
                      <FontAwesomeIcon icon={faCheck} /> ยืนยันปิดเคส
                    </button>
                  )}
              </div>
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
                  Timeline
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
              {currentRole === "SUPER_ADMIN" && (
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
                  <div className="admin-tool-row">
                    <div>
                      <b>รีเซ็ตรหัสติดตาม</b>
                      <small>ใช้เมื่อนักเรียนลืมรหัสติดตาม 6 หลัก</small>
                    </div>
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() => {
                        setResetPassword("");
                        setResetPasswordConfirm("");
                        setResetPasswordOpen(true);
                      }}
                    >
                      รีเซ็ตรหัส
                    </button>
                  </div>
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
          </aside>
        </div>
      )}
      {selected && resetPasswordOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setResetPasswordOpen(false);
          }}
        >
          <section
            className="tracking-reset-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span className="eyebrow">
                  <FontAwesomeIcon icon={faShieldHalved} /> ความปลอดภัย
                </span>
                <h2>รีเซ็ตรหัสติดตาม</h2>
                <p>{selected.case.case_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordOpen(false)}
                disabled={saving}
                aria-label="ปิด"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <div className="tracking-reset-body">
              <p>ตั้งรหัสใหม่ 6 หลัก รหัสเดิมจะใช้งานไม่ได้ทันที</p>
              <label>
                <span>รหัสใหม่</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={resetPassword}
                  onChange={(e) =>
                    setResetPassword(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                />
              </label>
              <label>
                <span>ยืนยันรหัสใหม่</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={resetPasswordConfirm}
                  onChange={(e) =>
                    setResetPasswordConfirm(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  maxLength={6}
                  placeholder="••••••"
                />
              </label>
              {resetPasswordConfirm &&
                resetPassword !== resetPasswordConfirm && (
                  <small className="password-mismatch">
                    รหัสทั้งสองช่องยังไม่ตรงกัน
                  </small>
                )}
              <footer>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setResetPasswordOpen(false)}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={
                    saving ||
                    resetPassword.length !== 6 ||
                    resetPassword !== resetPasswordConfirm
                  }
                  onClick={async () => {
                    await updateCase({ resetTrackingPassword: resetPassword });
                    setResetPasswordOpen(false);
                  }}
                >
                  บันทึกรหัสใหม่
                </button>
              </footer>
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
            transitionTarget === "ASSIGNED" ? pendingAssigneeName : undefined
          }
          closing={transitionTarget === "CLOSED"}
          saving={saving}
          onClose={() => setTransitionTarget("")}
          onConfirm={(handoffReason, dueDate) =>
            updateCase({
              status: transitionTarget,
              handoffReason,
              ...(transitionTarget === "ASSIGNED" && pendingAssignee
                ? { assignedTo: pendingAssignee }
                : {}),
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
}: {
  icon: typeof faFolderOpen;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <button
      type="button"
      className={`stat-card tone-${tone}`}
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
