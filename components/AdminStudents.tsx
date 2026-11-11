"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faFloppyDisk,
  faFolderOpen,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRotate,
  faSchool,
  faUserCheck,
  faUserGraduate,
  faUserSlash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { AdvisorSummary } from "../lib/types";

type StudentRow = {
  id: string;
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  level: string;
  classroom: string;
  number: number;
  advisors: AdvisorSummary[];
  advisor_names: string[];
  advisor1: string;
  advisor2: string | null;
  is_active: number;
  case_count: number;
  has_identity_number: number;
};

type StudentResponse = {
  students?: StudentRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
};

type StudentForm = {
  id: string;
  studentCode: string;
  prefix: "เด็กชาย" | "เด็กหญิง" | "นาย" | "นางสาว";
  firstName: string;
  lastName: string;
  level: "ม.1" | "ม.2" | "ม.3" | "ม.4" | "ม.5" | "ม.6";
  classroom: string;
  isActive: boolean;
  identityNumber: string;
};

const emptyForm: StudentForm = { id: "", studentCode: "", prefix: "นาย", firstName: "", lastName: "", level: "ม.1", classroom: "1", isActive: true, identityNumber: "" };
const studentPrefixes = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"] as const;
const levels = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"] as const;

export function AdminStudents() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<StudentRow | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);

  const roomCount = useMemo(() => new Set(students.map((student) => `${student.level}|${student.classroom}`)).size, [students]);
  const linkedCount = useMemo(() => students.filter((student) => student.advisors.length > 0).length, [students]);
  const caseCount = useMemo(() => students.reduce((sum, student) => sum + Number(student.case_count), 0), [students]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ search, page: String(page) });
      const response = await fetch(`/api/students?${params}`);
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json() as StudentResponse;
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถโหลดข้อมูลได้");
      setStudents(data.students ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(loadStudents, 250);
    return () => window.clearTimeout(timer);
  }, [loadStudents]);

  useEffect(() => {
    if (!showForm && !pendingStudent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setShowForm(false);
        setPendingStudent(null);
        setForm(emptyForm);
        setError("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingStudent, saving, showForm]);

  function startAdd() {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(student: StudentRow) {
    setForm({
      id: student.id,
      studentCode: student.student_code,
      prefix: student.prefix as StudentForm["prefix"],
      firstName: student.first_name,
      lastName: student.last_name,
      level: student.level as StudentForm["level"],
      classroom: student.classroom,
      isActive: Boolean(student.is_active),
      identityNumber: "",
    });
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const endpoint = form.id ? `/api/students/${form.id}` : "/api/students";
      const response = await fetch(endpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setShowForm(false);
      setForm(emptyForm);
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(student: StudentRow) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/students/${student.id}`, student.is_active ? { method: "DELETE" } : {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentCode: student.student_code, prefix: student.prefix, firstName: student.first_name, lastName: student.last_name, level: student.level, classroom: student.classroom, isActive: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "ดำเนินการไม่สำเร็จ");
      setPendingStudent(null);
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="management-page student-management-page">
      <header className="management-header">
        <div>
          <span className="eyebrow"><FontAwesomeIcon icon={faUserGraduate} /> จัดการข้อมูล</span>
          <h1>ข้อมูลนักเรียน</h1>
          <p>เพิ่ม แก้ไข ปิดใช้งาน และเชื่อมครูที่ปรึกษาตามห้องโดยอัตโนมัติ</p>
        </div>
        <div className="management-actions">
          <button className="button primary compact" onClick={startAdd}><FontAwesomeIcon icon={faPlus} /> เพิ่มนักเรียน</button>
          <button className="button secondary compact" onClick={loadStudents} disabled={loading}><FontAwesomeIcon icon={faRotate} /> รีเฟรช</button>
        </div>
      </header>

      {error && !showForm && !pendingStudent && <div className="management-error"><FontAwesomeIcon icon={faXmark} /> {error}</div>}

      <section className="management-summary student-summary" aria-label="สรุปข้อมูลนักเรียน">
        <article><span><FontAwesomeIcon icon={faUserGraduate} /></span><div><small>ผลลัพธ์ทั้งหมด</small><strong>{total}</strong><p>คน</p></div></article>
        <article><span><FontAwesomeIcon icon={faSchool} /></span><div><small>ห้องในหน้านี้</small><strong>{roomCount}</strong><p>ห้อง</p></div></article>
        <article><span><FontAwesomeIcon icon={faUserCheck} /></span><div><small>เชื่อมครูแล้ว</small><strong>{linkedCount}</strong><p>จาก {students.length} คน</p></div></article>
        <article><span><FontAwesomeIcon icon={faFolderOpen} /></span><div><small>เคสในหน้านี้</small><strong>{caseCount}</strong><p>เคส</p></div></article>
      </section>

      <section className="management-card student-data-card">
        <label className="management-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหารหัส ชื่อ หรือนามสกุลนักเรียน" /></label>
        {loading ? (
          <div className="table-skeleton"><span /><span /><span /></div>
        ) : error && students.length === 0 ? (
          <div className="empty-state"><h3>โหลดข้อมูลไม่สำเร็จ</h3><p>{error}</p><button className="button secondary" onClick={loadStudents}>ลองอีกครั้ง</button></div>
        ) : students.length === 0 ? (
          <div className="empty-state"><h3>ไม่พบนักเรียน</h3><p>ลองเปลี่ยนคำค้นหา หรือกดเพิ่มนักเรียนใหม่</p></div>
        ) : (
          <>
            <p className="auto-order-note">เลขที่เรียงอัตโนมัติแยกตามห้อง โดยนักเรียนชายมาก่อน แล้วตามด้วยนักเรียนหญิง</p>
            <div className="case-table-wrap student-table-wrap">
              <table className="case-table student-table">
                <thead><tr><th>นักเรียน</th><th>ชั้น / เลขที่</th><th>ครูที่ปรึกษา</th><th>จำนวนเคส</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>{students.map((student) => (
                  <tr key={student.id}>
                    <td data-label="นักเรียน"><div className="student-identity"><b>{student.prefix}{student.first_name} {student.last_name}</b><small>รหัส {student.student_code} · {student.has_identity_number ? "พร้อมยืนยันตัวตน" : "ยังไม่มีเลขยืนยันตัวตน"}</small></div></td>
                    <td data-label="ชั้น / เลขที่"><div className="student-room"><b>{student.level}/{student.classroom}</b><small>เลขที่ {student.number}</small></div></td>
                    <td data-label="ครูที่ปรึกษา"><span className="advisor-names">{student.advisors.length > 0 ? student.advisors.map((advisor) => <span key={advisor.id}>{advisor.display_name}</span>) : "ยังไม่กำหนด"}</span></td>
                    <td data-label="จำนวนเคส"><b>{student.case_count}</b></td>
                    <td data-label="สถานะ"><span className={`badge ${student.is_active ? "status-RESOLVED" : "severity-CRITICAL"}`}><FontAwesomeIcon icon={student.is_active ? faUserCheck : faUserSlash} />{student.is_active ? "ใช้งาน" : "ระงับ"}</span></td>
                    <td data-label="จัดการ"><div className="student-row-actions"><button type="button" onClick={() => startEdit(student)} aria-label={`แก้ไข ${student.first_name}`} title="แก้ไขข้อมูล"><FontAwesomeIcon icon={faPen} /></button><button type="button" className={student.is_active ? "danger" : "success"} onClick={() => { setError(""); setPendingStudent(student); }} aria-label={`${student.is_active ? "ลบ" : "เปิด"}ใช้งาน ${student.first_name}`} title={student.is_active ? "ลบจากรายการใช้งานโดยเก็บประวัติเดิม" : "เปิดใช้งาน"}><FontAwesomeIcon icon={student.is_active ? faUserSlash : faUserCheck} /></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <footer className="table-pagination">
              <p>หน้า {page} จาก {totalPages} · แสดง {students.length} จาก {total} คน</p>
              <div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} aria-label="หน้าก่อนหน้า"><FontAwesomeIcon icon={faChevronLeft} /> ก่อนหน้า</button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} aria-label="หน้าถัดไป">ถัดไป <FontAwesomeIcon icon={faChevronRight} /></button></div>
            </footer>
          </>
        )}
      </section>

      {showForm && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setShowForm(false); setForm(emptyForm); setError(""); } }}><section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
        <form onSubmit={saveStudent}>
          <header className="student-modal-header"><div><span className="student-modal-icon"><FontAwesomeIcon icon={form.id ? faPen : faPlus} /></span><div><small>{form.id ? "แก้ไขรายการเดิม" : "สร้างรายการใหม่"}</small><h2 id="student-modal-title">{form.id ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มนักเรียน"}</h2></div></div><button type="button" onClick={() => { setShowForm(false); setForm(emptyForm); setError(""); }} disabled={saving} aria-label="ปิด Modal"><FontAwesomeIcon icon={faXmark} /></button></header>
          <div className="student-modal-body"><p className="student-modal-help">กรอกข้อมูลพื้นฐานให้ครบ เลขที่และครูที่ปรึกษาจะจัดเรียงและเชื่อมตามห้องโดยอัตโนมัติ</p>{error && <div className="student-modal-error"><FontAwesomeIcon icon={faXmark} /> {error}</div>}<div className="student-form-grid">
            <label><span>รหัสนักเรียน</span><input autoFocus value={form.studentCode} onChange={(event) => setForm({ ...form, studentCode: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" minLength={4} placeholder="เช่น 12345" required /></label>
            <label><span>เลขประจำตัวบุคคล / รหัส G</span><input value={form.identityNumber} onChange={(event) => setForm({ ...form, identityNumber: event.target.value.toUpperCase().replace(/[^0-9G๐-๙\s-]/g, "").slice(0, 17) })} autoComplete="off" placeholder={form.id ? "เว้นว่างหากไม่เปลี่ยน" : "เลข 13 หลัก หรือ G ตามด้วย 12 หลัก"} required={!form.id} /><small>{form.id ? "กรอกเฉพาะเมื่อต้องการแก้เลขยืนยันตัวตนเดิม" : "ระบบจะเก็บเฉพาะค่าแฮช ไม่เก็บเลขจริง"}</small></label>
            <label><span>คำนำหน้า</span><select value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value as StudentForm["prefix"] })}>{studentPrefixes.map((prefix) => <option key={prefix}>{prefix}</option>)}</select></label>
            <label><span>ชื่อ</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="ชื่อจริง" required /></label>
            <label><span>นามสกุล</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="นามสกุล" required /></label>
            <label><span>ระดับชั้น</span><select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as StudentForm["level"] })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
            <label><span>ห้อง</span><input value={form.classroom} onChange={(event) => setForm({ ...form, classroom: event.target.value.replace(/\D/g, "").slice(0, 2) })} inputMode="numeric" placeholder="เช่น 1" required /></label>
          </div></div>
          <footer className="student-modal-actions"><button type="button" className="button secondary" onClick={() => { setShowForm(false); setForm(emptyForm); setError(""); }} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลนักเรียน"}</button></footer>
        </form>
      </section></div>}

      {pendingStudent && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setPendingStudent(null); setError(""); } }}><section className="student-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="student-confirm-title">
        <span className={pendingStudent.is_active ? "danger" : "success"}><FontAwesomeIcon icon={pendingStudent.is_active ? faUserSlash : faUserCheck} /></span>
        <h2 id="student-confirm-title">{pendingStudent.is_active ? "ยืนยันการลบนักเรียน" : "เปิดใช้งานนักเรียน"}</h2>
        <p>{pendingStudent.is_active ? "นักเรียนจะถูกนำออกจากรายการใช้งาน แต่ประวัติเคสและข้อมูลเดิมจะยังถูกเก็บไว้อย่างปลอดภัย" : "นักเรียนจะกลับมาใช้งานในระบบและสามารถส่งเรื่องได้ตามปกติ"}</p>
        <div className="student-confirm-person"><b>{pendingStudent.prefix}{pendingStudent.first_name} {pendingStudent.last_name}</b><small>รหัส {pendingStudent.student_code} · {pendingStudent.level}/{pendingStudent.classroom}</small></div>
        {error && <div className="student-modal-error"><FontAwesomeIcon icon={faXmark} /> {error}</div>}
        <div className="student-confirm-actions"><button type="button" className="button secondary" onClick={() => { setPendingStudent(null); setError(""); }} disabled={saving}>ยกเลิก</button><button type="button" className={pendingStudent.is_active ? "button danger-button" : "button primary"} onClick={() => toggleActive(pendingStudent)} disabled={saving}>{saving ? "กำลังดำเนินการ..." : pendingStudent.is_active ? "ลบจากรายการใช้งาน" : "เปิดใช้งาน"}</button></div>
      </section></div>}
    </main>
  );
}
