"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft, faArrowRight, faBell, faBookOpen, faBoxOpen, faChartLine,
  faCheck, faCheckCircle, faChevronRight, faCircleInfo, faClock,
  faCopy, faFileArrowUp, faFolderOpen, faHeart, faLightbulb,
  faMagnifyingGlass, faMessage, faPaperPlane, faPeopleGroup, faPlus,
  faRotate, faSchool, faShieldHalved, faTriangleExclamation, faUserGraduate,
  faUserShield, faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { CaseRecord, Student } from "../lib/types";

type AppView = "home" | "report" | "track" | "admin";
type Category = { id: string; name: string; icon: string; color: string };
type Detail = { case: CaseRecord & Record<string, string | number | null>; timeline: Timeline[]; notes: Note[] };
type Timeline = { id: string; title: string; description: string | null; created_at: string; created_by: string };
type Note = { id: string; note: string; created_at: string; created_by: string };

const categoryIcons = [faUserShield, faHeart, faShieldHalved, faTriangleExclamation, faBookOpen, faSchool, faLightbulb, faMessage];
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

const statusLabels: Record<string, string> = {
  NEW: "รับเรื่องแล้ว", SCREENING: "กำลังตรวจสอบ", IN_PROGRESS: "กำลังดำเนินการ",
  DIRECTOR_REVIEW: "เสนอผู้อำนวยการ", RESOLVED: "ดำเนินการเรียบร้อย", CLOSED: "ปิดเรื่อง",
};
const severityLabels: Record<string, string> = {
  GENERAL: "ทั่วไป", CONCERN: "ควรติดตาม", SERIOUS: "ร้ายแรง", CRITICAL: "เร่งด่วน",
};

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
      {view !== "admin" && <PublicFooter />}
      {toast && <div className="toast" role="status"><FontAwesomeIcon icon={faCheckCircle} /> {toast}</div>}
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/" className="brand" aria-label="กล่องแดง หน้าแรก">
        <Image src="/images/chomthong-logo.png" width={50} height={50} alt="ตราโรงเรียนจอมทอง" priority />
        <span><strong>กล่องแดง</strong><small>RED BOX · โรงเรียนจอมทอง</small></span>
      </Link>
      <nav aria-label="เมนูหลัก">
        <Link href="/track"><FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะ</Link>
        <Link href="/report" className="button primary compact"><FontAwesomeIcon icon={faMessage} /> แจ้งเรื่อง</Link>
      </nav>
    </header>
  );
}

function HomeContent() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="safe-pill"><FontAwesomeIcon icon={faShieldHalved} /> พื้นที่ปลอดภัยสำหรับนักเรียน</span>
          <h1>ทุกเสียงของคุณ<br /><em>มีความหมาย</em></h1>
          <p className="hero-lead">มีเรื่องไม่สบายใจ เจอปัญหา หรืออยากให้โรงเรียนช่วย บอกเราได้ที่นี่</p>
          <div className="hero-actions">
            <Link href="/report" className="button primary large"><FontAwesomeIcon icon={faMessage} /> แจ้งปัญหา / ขอความช่วยเหลือ</Link>
            <Link href="/track" className="button secondary large"><FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะเรื่อง</Link>
          </div>
          <div className="trust-row">
            <span><FontAwesomeIcon icon={faCheckCircle} /> เลือกปกปิดตัวตนได้</span>
            <span><FontAwesomeIcon icon={faCheckCircle} /> ข้อมูลได้รับการดูแล</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="glow one" /><div className="glow two" />
          <div className="message-card card-one"><FontAwesomeIcon icon={faHeart} /><span>เราอยู่ตรงนี้<br /><b>พร้อมรับฟังคุณ</b></span></div>
          <div className="red-box"><div className="box-slot" /><FontAwesomeIcon icon={faMessage} /></div>
          <div className="message-card card-two"><FontAwesomeIcon icon={faShieldHalved} /><span><b>ปลอดภัย</b><br />และเป็นความลับ</span></div>
        </div>
      </section>

      <section className="category-section">
        <div className="section-heading"><span>บอกเราได้ทุกเรื่อง</span><h2>เรื่องไหนที่อยากให้เราช่วย?</h2><p>เลือกหัวข้อที่ใกล้เคียงที่สุด ไม่ต้องกังวลว่าจะเลือกผิด</p></div>
        <div className="category-grid">
          {categoryFallbacks.map((category, index) => (
            <Link href="/report" key={category.id} className={`category-card tone-${category.color}`}>
              <span className="category-icon"><FontAwesomeIcon icon={categoryIcons[index]} /></span>
              <strong>{category.name}</strong><FontAwesomeIcon className="category-arrow" icon={faChevronRight} />
            </Link>
          ))}
        </div>
      </section>

      <section className="promise-section">
        <div><span className="eyebrow">คำสัญญาจากเรา</span><h2>คุณไม่ได้อยู่กับปัญหานี้เพียงลำพัง</h2></div>
        <div className="promise-grid">
          <article><FontAwesomeIcon icon={faPeopleGroup} /><h3>มีคนรับฟัง</h3><p>เจ้าหน้าที่ที่เหมาะสมจะช่วยดูแลเรื่องของคุณอย่างตั้งใจ</p></article>
          <article><FontAwesomeIcon icon={faShieldHalved} /><h3>เคารพความเป็นส่วนตัว</h3><p>คุณเลือกปกปิดชื่อจากเจ้าหน้าที่ทั่วไปได้</p></article>
          <article><FontAwesomeIcon icon={faClock} /><h3>ติดตามได้</h3><p>ใช้หมายเลขเคสตรวจสอบความคืบหน้าได้ทุกเวลา</p></article>
        </div>
      </section>
    </main>
  );
}

function ReportWizard({ notify }: { notify: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [form, setForm] = useState({
    categoryId: "", isAnonymous: true, title: "", description: "", location: "",
    peopleInvolved: "", requestedHelp: "ขอคำปรึกษา", safetyLevel: "SAFE" as "SAFE" | "UNSURE" | "UNSAFE",
  });
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetch("/api/categories").then((r) => readJson<{ categories: Category[] }>(r)).then((d) => setCategories(d.categories ?? [])).catch(() => undefined);
  }, []);

  async function verifyStudent(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/students/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentCode }) });
      const data = await readJson<{ student: Student; error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      setStudent(data.student); notify("พบข้อมูลนักเรียนแล้ว");
    } catch (e) { setError(e instanceof Error ? e.message : "ไม่สามารถตรวจสอบข้อมูลได้"); }
    finally { setLoading(false); }
  }

  function canContinue() {
    if (step === 1) return Boolean(student);
    if (step === 2) return Boolean(form.categoryId);
    if (step === 3) return form.title.trim().length >= 5 && form.description.trim().length >= 10;
    return true;
  }

  async function submitReport() {
    if (!student || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/cases", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, studentId: student.id, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await readJson<{ caseNumber: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error);
      for (const file of files) {
        const upload = new FormData();
        upload.set("caseNumber", data.caseNumber);
        upload.set("file", file);
        const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
        if (!uploadResponse.ok) throw new Error("ส่งเรื่องแล้ว แต่มีไฟล์หลักฐานบางรายการอัปโหลดไม่สำเร็จ");
      }
      setCaseNumber(data.caseNumber); setStep(7); notify("ส่งเรื่องเรียบร้อยแล้ว");
    } catch (e) { setError(e instanceof Error ? e.message : "ไม่สามารถส่งเรื่องได้"); }
    finally { setLoading(false); }
  }

  if (step === 7) {
    return <main className="form-page"><section className="success-card"><span className="success-icon"><FontAwesomeIcon icon={faCheck} /></span><span className="eyebrow">เราได้รับเรื่องของคุณแล้ว</span><h1>ขอบคุณที่ไว้ใจเรา</h1><p>เจ้าหน้าที่จะดูแลเรื่องนี้อย่างเหมาะสม กรุณาเก็บหมายเลขเคสไว้สำหรับติดตามสถานะ</p><div className="case-number"><small>หมายเลขเคส</small><strong>{caseNumber}</strong></div><div className="success-actions"><button className="button secondary" onClick={() => { navigator.clipboard.writeText(caseNumber); notify("คัดลอกหมายเลขเคสแล้ว"); }}><FontAwesomeIcon icon={faCopy} /> คัดลอกหมายเลขเคส</button><Link className="button primary" href="/track"><FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะ</Link></div></section></main>;
  }

  return (
    <main className="form-page">
      <section className="form-wrap">
        <div className="form-intro"><span className="eyebrow">แจ้งเรื่องอย่างปลอดภัย</span><h1>{step === 1 ? "เริ่มต้นด้วยข้อมูลของคุณ" : "เล่าให้เราฟังได้เลย"}</h1><p>ใช้เวลาประมาณ 3–5 นาที ข้อมูลของคุณจะไม่หายเมื่อย้อนกลับ</p></div>
        <div className="stepper" aria-label={`ขั้นตอนที่ ${step} จาก 6`}>
          {["ข้อมูลของฉัน", "ประเภทเรื่อง", "รายละเอียด", "ความช่วยเหลือ", "หลักฐาน", "ตรวจสอบ"].map((label, index) => <div key={label} className={index + 1 <= step ? "active" : ""}><span>{index + 1 < step ? <FontAwesomeIcon icon={faCheck} /> : index + 1}</span><small>{label}</small></div>)}
        </div>
        <div className="wizard-card">
          {step === 1 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faUserGraduate} /><div><h2>ยืนยันข้อมูลนักเรียน</h2><p>กรอกเลขประจำตัวนักเรียนเพื่อค้นหาข้อมูล</p></div></div><form onSubmit={verifyStudent} className="lookup-row"><label><span>เลขประจำตัวนักเรียน</span><input inputMode="numeric" value={studentCode} onChange={(e) => { setStudentCode(e.target.value.replace(/\D/g, "")); setStudent(null); }} placeholder="เช่น 12345" maxLength={10} /></label><button className="button primary" disabled={loading || studentCode.length < 4}>{loading ? <><span className="spinner" /> กำลังค้นหา...</> : <><FontAwesomeIcon icon={faMagnifyingGlass} /> ค้นหาข้อมูล</>}</button></form>{student && <div className="student-card"><span><FontAwesomeIcon icon={faUserGraduate} /></span><div><small>ข้อมูลที่ค้นพบ</small><h3>{student.prefix}{student.first_name} {student.last_name}</h3><p>{student.level}/{student.classroom} เลขที่ {student.number}</p><p className="advisor">ครูที่ปรึกษา: {student.advisor1}{student.advisor2 ? ` / ${student.advisor2}` : ""}</p></div><FontAwesomeIcon className="verified" icon={faCheckCircle} /></div>}<p className="helper"><FontAwesomeIcon icon={faShieldHalved} /> ระบบใช้ข้อมูลนี้เพื่อยืนยันสิทธิ์และติดตามเรื่องเท่านั้น</p></div>}
          {step === 2 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faFolderOpen} /><div><h2>เรื่องที่อยากบอก</h2><p>เลือกประเภทที่ใกล้เคียงที่สุด</p></div></div><div className="choice-grid">{(categories.length ? categories : categoryFallbacks).map((category, index) => <button key={category.id} className={form.categoryId === category.id ? "choice selected" : "choice"} onClick={() => setForm({ ...form, categoryId: category.id })}><FontAwesomeIcon icon={categoryIcons[index % categoryIcons.length]} /><span>{category.name}</span>{form.categoryId === category.id && <FontAwesomeIcon className="choice-check" icon={faCheckCircle} />}</button>)}</div><fieldset className="privacy-field"><legend>การแสดงตัวตนต่อเจ้าหน้าที่ทั่วไป</legend><label className={form.isAnonymous ? "selected" : ""}><input type="radio" checked={form.isAnonymous} onChange={() => setForm({ ...form, isAnonymous: true })} /><FontAwesomeIcon icon={faShieldHalved} /><span><b>ปกปิดตัวตน</b><small>เจ้าหน้าที่ทั่วไปจะไม่เห็นชื่อ ชั้น ห้อง</small></span></label><label className={!form.isAnonymous ? "selected" : ""}><input type="radio" checked={!form.isAnonymous} onChange={() => setForm({ ...form, isAnonymous: false })} /><FontAwesomeIcon icon={faUserGraduate} /><span><b>เปิดเผยตัวตน</b><small>ช่วยให้เจ้าหน้าที่ติดต่อช่วยเหลือได้เร็วขึ้น</small></span></label></fieldset></div>}
          {step === 3 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faMessage} /><div><h2>เล่าให้เราฟัง</h2><p>คุณสามารถเล่าเท่าที่สะดวก</p></div></div><div className="form-grid"><label className="full"><span>หัวข้อเรื่อง *</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="สรุปสั้น ๆ ว่าเกิดอะไรขึ้น" maxLength={160} /></label><label className="full"><span>เกิดอะไรขึ้น? *</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="เล่าเหตุการณ์ให้เราฟังได้เลย คุณสามารถเล่าเท่าที่สะดวก" rows={7} maxLength={5000} /></label><label><span>สถานที่เกิดเหตุ</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="ไม่บังคับ" /></label><label><span>บุคคลที่เกี่ยวข้อง</span><input value={form.peopleInvolved} onChange={(e) => setForm({ ...form, peopleInvolved: e.target.value })} placeholder="ไม่บังคับ" /></label></div></div>}
          {step === 4 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faHeart} /><div><h2>อยากให้โรงเรียนช่วยอย่างไร?</h2><p>เลือกสิ่งที่คุณต้องการมากที่สุดในตอนนี้</p></div></div><div className="help-options">{["รับทราบ", "ขอคำปรึกษา", "ช่วยพูดคุย", "ช่วยไกล่เกลี่ย", "ตรวจสอบ", "หยุดเหตุการณ์", "ช่วยเหลือเร่งด่วน", "อื่น ๆ"].map((item) => <button key={item} className={form.requestedHelp === item ? "selected" : ""} onClick={() => setForm({ ...form, requestedHelp: item })}>{item}</button>)}</div><fieldset className="safety-field"><legend>ตอนนี้คุณรู้สึกปลอดภัยหรือไม่?</legend>{[["SAFE", "ปลอดภัย", "green"], ["UNSURE", "กังวล / ไม่แน่ใจ", "amber"], ["UNSAFE", "ไม่ปลอดภัย", "red"]].map(([value, label, tone]) => <label className={`${tone} ${form.safetyLevel === value ? "selected" : ""}`} key={value}><input type="radio" checked={form.safetyLevel === value} onChange={() => setForm({ ...form, safetyLevel: value as typeof form.safetyLevel })} /><span className="status-dot" /><b>{label}</b></label>)}</fieldset>{form.safetyLevel === "UNSAFE" && <div className="urgent-message"><FontAwesomeIcon icon={faTriangleExclamation} /><span><b>เราจะส่งเรื่องนี้ให้เจ้าหน้าที่ตรวจสอบทันที</b><small>หากอยู่ในอันตรายเร่งด่วน ให้ติดต่อครูที่อยู่ใกล้ที่สุดหรือโทร 191</small></span></div>}</div>}
          {step === 5 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faFileArrowUp} /><div><h2>แนบหลักฐาน</h2><p>ไม่บังคับ — แนบเฉพาะไฟล์ที่คุณสะดวก</p></div></div><label className="dropzone"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const selected = Array.from(e.target.files ?? []).filter((file) => file.size <= 8 * 1024 * 1024).slice(0, 5); setFiles(selected); if ((e.target.files?.length ?? 0) > selected.length) notify("เลือกได้สูงสุด 5 ไฟล์ และไฟล์ละไม่เกิน 8 MB"); }} /><FontAwesomeIcon icon={faFileArrowUp} /><b>เลือกไฟล์หลักฐาน</b><span>JPG, PNG, WEBP หรือ PDF · สูงสุด 5 ไฟล์</span></label>{files.length > 0 && <div className="file-list">{files.map((file) => <div key={`${file.name}-${file.size}`}><FontAwesomeIcon icon={faFolderOpen} /><span><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><button aria-label={`นำ ${file.name} ออก`} onClick={() => setFiles(files.filter((item) => item !== file))}><FontAwesomeIcon icon={faXmark} /></button></div>)}</div>}<p className="helper"><FontAwesomeIcon icon={faShieldHalved} /> ไฟล์จะถูกจัดเก็บแบบส่วนตัวและเปิดได้เฉพาะผู้มีสิทธิ์</p></div>}
          {step === 6 && <div className="wizard-content"><div className="card-heading"><FontAwesomeIcon icon={faCheckCircle} /><div><h2>ตรวจสอบก่อนส่ง</h2><p>โปรดตรวจข้อมูลอีกครั้ง เมื่อพร้อมแล้วกดส่งเรื่อง</p></div></div><div className="review-grid"><Review label="ผู้แจ้ง" value={form.isAnonymous ? "ปกปิดตัวตน" : `${student?.prefix}${student?.first_name} ${student?.last_name}`} /><Review label="ประเภท" value={(categories.find((c) => c.id === form.categoryId) ?? categoryFallbacks.find((c) => c.id === form.categoryId))?.name ?? "-"} /><Review label="หัวข้อ" value={form.title} /><Review label="ต้องการให้ช่วย" value={form.requestedHelp} /><Review label="ความปลอดภัย" value={form.safetyLevel === "SAFE" ? "ปลอดภัย" : form.safetyLevel === "UNSURE" ? "กังวล / ไม่แน่ใจ" : "ไม่ปลอดภัย"} /><Review label="หลักฐาน" value={files.length ? `${files.length} ไฟล์` : "ไม่ได้แนบ"} /><div className="review-detail"><small>รายละเอียด</small><p>{form.description}</p></div></div></div>}
          {error && <div className="inline-error" role="alert"><FontAwesomeIcon icon={faCircleInfo} /> {error}</div>}
          <div className="wizard-actions">{step > 1 ? <button className="button secondary" onClick={() => setStep(step - 1)}><FontAwesomeIcon icon={faArrowLeft} /> ย้อนกลับ</button> : <Link href="/" className="button secondary"><FontAwesomeIcon icon={faArrowLeft} /> กลับหน้าแรก</Link>}<span>ขั้นตอน {step} จาก 6</span>{step < 6 ? <button className="button primary" disabled={!canContinue()} onClick={() => setStep(step + 1)}>ถัดไป <FontAwesomeIcon icon={faArrowRight} /></button> : <button className="button primary" disabled={loading} onClick={submitReport}>{loading ? <><span className="spinner" /> กำลังส่ง...</> : <><FontAwesomeIcon icon={faPaperPlane} /> ส่งเรื่อง</>}</button>}</div>
        </div>
      </section>
    </main>
  );
}

function Review({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><b>{value}</b></div>; }

function Tracking({ notify }: { notify: (message: string) => void }) {
  const [studentCode, setStudentCode] = useState(""); const [caseNumber, setCaseNumber] = useState("");
  const [item, setItem] = useState<Record<string, string> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function track(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); setItem(null); try { const response = await fetch(`/api/cases?caseNumber=${encodeURIComponent(caseNumber)}&studentCode=${encodeURIComponent(studentCode)}`); const data = await readJson<{ case: Record<string, string>; error?: string }>(response); if (!response.ok) throw new Error(data.error); setItem(data.case); notify("พบข้อมูลสถานะเรื่องแล้ว"); } catch (e) { setError(e instanceof Error ? e.message : "ไม่สามารถค้นหาได้"); } finally { setLoading(false); } }
  const steps = ["NEW", "SCREENING", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  return <main className="tracking-page"><section className="tracking-wrap"><div className="form-intro"><span className="eyebrow">ติดตามความคืบหน้า</span><h1>ตรวจสอบสถานะเรื่อง</h1><p>ใช้เลขประจำตัวนักเรียนและหมายเลขเคสที่ได้รับหลังส่งเรื่อง</p></div><div className="tracking-card"><form onSubmit={track} className="tracking-form"><label><span>เลขประจำตัวนักเรียน</span><input value={studentCode} inputMode="numeric" onChange={(e) => setStudentCode(e.target.value.replace(/\D/g, ""))} placeholder="เช่น 12345" /></label><label><span>หมายเลขเคส</span><input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value.toUpperCase())} placeholder="RB-2026-000001" /></label><button className="button primary" disabled={loading || !studentCode || !caseNumber}>{loading ? <><span className="spinner" /> กำลังค้นหา...</> : <><FontAwesomeIcon icon={faMagnifyingGlass} /> ตรวจสอบสถานะ</>}</button></form>{error && <div className="inline-error"><FontAwesomeIcon icon={faCircleInfo} /> {error}</div>}{item && <div className="tracking-result"><div className="tracking-result-head"><span><FontAwesomeIcon icon={faCheckCircle} /></span><div><small>{item.case_number}</small><h2>{item.title}</h2><p>{item.category_name} · แจ้งเมื่อ {formatDate(item.created_at)}</p></div><b className={`badge status-${item.status}`}>{statusLabels[item.status]}</b></div><div className="status-progress">{steps.map((status, index) => { const current = Math.max(steps.indexOf(item.status), item.status === "DIRECTOR_REVIEW" ? 2 : 0); return <div className={index <= current ? "done" : ""} key={status}><span>{index < current ? <FontAwesomeIcon icon={faCheck} /> : index + 1}</span><small>{statusLabels[status]}</small></div>; })}</div><div className="privacy-note"><FontAwesomeIcon icon={faShieldHalved} /><span><b>ข้อมูลของคุณยังปลอดภัย</b><small>หน้านี้แสดงเฉพาะความคืบหน้าที่เหมาะสมสำหรับนักเรียน</small></span></div></div>}</div></section></main>;
}

function AdminDashboard({ notify }: { notify: (message: string) => void }) {
  const [cases, setCases] = useState<CaseRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [severity, setSeverity] = useState(""); const [selected, setSelected] = useState<Detail | null>(null); const [saving, setSaving] = useState(false); const [note, setNote] = useState("");
  async function loadCases() { setLoading(true); setError(""); try { const params = new URLSearchParams(); if (search) params.set("search", search); if (status) params.set("status", status); if (severity) params.set("severity", severity); const response = await fetch(`/api/cases?${params}`); if (response.status === 401) { window.location.href = "/admin/login"; return; } const data = await readJson<{ cases: CaseRecord[]; error?: string }>(response); if (!response.ok) throw new Error(data.error); setCases(data.cases ?? []); } catch (e) { setError(e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้"); } finally { setLoading(false); } }
  // Search state intentionally controls the debounced reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(loadCases, 280); return () => window.clearTimeout(timer); }, [search, status, severity]);
  async function openCase(caseNumber: string) { try { const response = await fetch(`/api/cases/${caseNumber}`); const data = await readJson<Detail & { error?: string }>(response); if (!response.ok) throw new Error(data.error); setSelected(data); } catch { notify("ไม่สามารถโหลดรายละเอียดเคสได้"); } }
  async function updateCase(payload: Record<string, string>) { if (!selected) return; setSaving(true); try { const response = await fetch(`/api/cases/${selected.case.case_number}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await readJson<{ error?: string }>(response); if (!response.ok) throw new Error(data.error); notify("บันทึกข้อมูลเรียบร้อยแล้ว"); setNote(""); await loadCases(); await openCase(selected.case.case_number); } catch (e) { notify(e instanceof Error ? e.message : "ไม่สามารถบันทึกข้อมูลได้"); } finally { setSaving(false); } }
  const counts = useMemo(() => ({ all: cases.length, new: cases.filter((c) => c.status === "NEW").length, immediate: cases.filter((c) => c.requires_immediate_review).length, critical: cases.filter((c) => c.severity === "CRITICAL").length, progress: cases.filter((c) => c.status === "IN_PROGRESS").length, closed: cases.filter((c) => ["RESOLVED", "CLOSED"].includes(c.status)).length }), [cases]);
  return <div className="admin-layout"><aside className="sidebar"><Link className="admin-brand" href="/"><Image src="/images/chomthong-logo.png" width={52} height={52} alt="ตราโรงเรียนจอมทอง" /><span><b>กล่องแดง</b><small>โรงเรียนจอมทอง</small></span></Link><nav><span className="nav-label">ภาพรวม</span><a className="active"><FontAwesomeIcon icon={faChartLine} /> Dashboard</a><span className="nav-label">จัดการเคส</span><a><FontAwesomeIcon icon={faFolderOpen} /> เคสทั้งหมด <b>{counts.all}</b></a><a><FontAwesomeIcon icon={faMessage} /> เคสใหม่ <b>{counts.new}</b></a><a className="danger"><FontAwesomeIcon icon={faTriangleExclamation} /> ตรวจสอบทันที <b>{counts.immediate}</b></a><a><FontAwesomeIcon icon={faUserGraduate} /> นักเรียน</a></nav><div className="sidebar-profile"><span>ผ</span><div><b>ผู้ดูแลระบบ</b><small>ADMIN</small></div></div></aside><main className="admin-main"><header className="admin-header"><div><small>วันทำการวันนี้</small><b>{new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date())}</b></div><button aria-label="การแจ้งเตือน"><FontAwesomeIcon icon={faBell} /><span>{counts.immediate}</span></button></header><section className="dashboard-content"><div className="dashboard-heading"><div><span className="eyebrow">ศูนย์ดูแลนักเรียน</span><h1>สวัสดีครับ ผู้ดูแลระบบ</h1><p>ภาพรวมเคสและเรื่องที่ต้องให้ความสำคัญวันนี้</p></div><button className="button secondary" onClick={loadCases}><FontAwesomeIcon icon={faRotate} /> รีเฟรช</button></div><div className="stat-grid"><Stat icon={faFolderOpen} label="เรื่องทั้งหมด" value={counts.all} tone="blue" /><Stat icon={faMessage} label="เคสใหม่" value={counts.new} tone="cyan" /><Stat icon={faTriangleExclamation} label="ตรวจสอบทันที" value={counts.immediate} tone="red" /><Stat icon={faClock} label="กำลังดำเนินการ" value={counts.progress} tone="amber" /><Stat icon={faShieldHalved} label="Critical" value={counts.critical} tone="orange" /><Stat icon={faCheckCircle} label="สำเร็จ / ปิดแล้ว" value={counts.closed} tone="green" /></div><section className="case-panel"><div className="panel-heading"><div><h2>รายการเคสล่าสุด</h2><p>ค้นหา คัดกรอง และเปิดดูรายละเอียดได้ทันที</p></div></div><div className="filter-bar"><label className="search-box"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา Case ID หรือหัวข้อ..." /></label><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="กรองความสำคัญ"><option value="">ทุกระดับ</option>{Object.entries(severityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>{(status || severity || search) && <button className="clear-filter" onClick={() => { setStatus(""); setSeverity(""); setSearch(""); }}><FontAwesomeIcon icon={faXmark} /> ล้างตัวกรอง</button>}</div>{loading ? <div className="table-skeleton">{[1,2,3,4].map((i) => <span key={i} />)}</div> : error ? <div className="empty-state"><FontAwesomeIcon icon={faCircleInfo} /><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>{error}</p><button className="button secondary" onClick={loadCases}>ลองอีกครั้ง</button></div> : cases.length === 0 ? <div className="empty-state"><FontAwesomeIcon icon={faBoxOpen} /><h3>ยังไม่มีเคสในรายการนี้</h3><p>เมื่อมีเรื่องใหม่ รายการจะแสดงที่นี่</p></div> : <div className="case-table-wrap"><table className="case-table"><thead><tr><th>Case ID</th><th>วันที่แจ้ง</th><th>ประเภท</th><th>ความสำคัญ</th><th>สถานะ</th><th>ผู้แจ้ง</th><th></th></tr></thead><tbody>{cases.map((item) => <tr key={item.id} className={item.requires_immediate_review ? "immediate" : ""} onClick={() => openCase(item.case_number)}><td><b>{item.case_number}</b>{item.requires_immediate_review ? <small className="urgent-label"><FontAwesomeIcon icon={faTriangleExclamation} /> ทันที</small> : null}</td><td>{formatDate(item.created_at)}</td><td>{item.category_name}</td><td><span className={`badge severity-${item.severity}`}>{severityLabels[item.severity]}</span></td><td><span className={`badge status-${item.status}`}>{statusLabels[item.status]}</span></td><td>{item.reporter_name}</td><td><FontAwesomeIcon icon={faChevronRight} /></td></tr>)}</tbody></table></div>}</section></section></main>{selected && <div className="drawer-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setSelected(null); }}><aside className="case-drawer"><header><div><small>รายละเอียดเคส</small><h2>{selected.case.case_number}</h2></div><button onClick={() => setSelected(null)} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button></header><div className="drawer-body"><div className="case-badges"><span className={`badge severity-${selected.case.severity}`}>{severityLabels[selected.case.severity]}</span><span className={`badge status-${selected.case.status}`}>{statusLabels[selected.case.status]}</span></div><h3>{selected.case.title}</h3><p className="case-description">{selected.case.description}</p><div className="detail-grid"><Review label="ประเภท" value={String(selected.case.category_name)} /><Review label="ความปลอดภัย" value={selected.case.safety_level === "UNSAFE" ? "ไม่ปลอดภัย" : selected.case.safety_level === "UNSURE" ? "กังวล" : "ปลอดภัย"} /><Review label="ผู้แจ้ง" value={selected.case.is_anonymous ? "ปกปิดตัวตน" : `${selected.case.prefix}${selected.case.first_name} ${selected.case.last_name}`} /><Review label="ผู้รับผิดชอบ" value={String(selected.case.assigned_to ?? "ยังไม่ได้มอบหมาย")} /></div><div className="action-card"><h4>จัดการเคส</h4><label><span>สถานะ</span><select value={selected.case.status} onChange={(e) => updateCase({ status: e.target.value })} disabled={saving}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>ระดับความสำคัญ</span><select value={selected.case.severity} onChange={(e) => updateCase({ severity: e.target.value })} disabled={saving}>{Object.entries(severityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>มอบหมายให้</span><div className="inline-action"><input defaultValue={String(selected.case.assigned_to ?? "")} id="assign-input" placeholder="ชื่อเจ้าหน้าที่" /><button onClick={() => { const input = document.getElementById("assign-input") as HTMLInputElement; updateCase({ assignedTo: input.value }); }} disabled={saving}><FontAwesomeIcon icon={faCheck} /></button></div></label></div><div className="note-card"><h4>บันทึกภายใน</h4><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="เพิ่มบันทึกสำหรับเจ้าหน้าที่..." /><button className="button primary compact" disabled={saving || note.trim().length < 2} onClick={() => updateCase({ note })}>{saving ? <><span className="spinner" /> กำลังบันทึก...</> : <><FontAwesomeIcon icon={faPlus} /> เพิ่มบันทึก</>}</button>{selected.notes.map((item) => <div className="note-item" key={item.id}><p>{item.note}</p><small>{item.created_by} · {formatDate(item.created_at)}</small></div>)}</div><div className="timeline-card"><h4>Timeline</h4>{selected.timeline.map((item) => <div className="timeline-item" key={item.id}><span /><div><b>{item.title}</b>{item.description && <p>{item.description}</p>}<small>{formatDate(item.created_at)} · {item.created_by}</small></div></div>)}</div></div></aside></div>}</div>;
}

function Stat({ icon, label, value, tone }: { icon: typeof faFolderOpen; label: string; value: number; tone: string }) { return <article className={`stat-card tone-${tone}`}><span><FontAwesomeIcon icon={icon} /></span><div><small>{label}</small><strong>{value}</strong></div><FontAwesomeIcon className="stat-arrow" icon={faChevronRight} /></article>; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.endsWith("Z") ? value : `${value}Z`)); } catch { return value; } }

function PublicFooter() { return <footer className="public-footer"><div className="brand"><Image src="/images/chomthong-logo.png" width={42} height={42} alt="ตราโรงเรียนจอมทอง" /><span><strong>กล่องแดง</strong><small>โรงเรียนจอมทอง</small></span></div><p>พื้นที่ปลอดภัยสำหรับทุกเสียงของนักเรียน</p><Link href="/admin/login">สำหรับเจ้าหน้าที่</Link></footer>; }
