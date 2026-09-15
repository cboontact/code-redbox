"use client";
/* eslint-disable @next/next/no-img-element -- Local static school logo does not require an image optimization service. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircleInfo, faClock, faFolderOpen, faGavel, faRotate, faRightFromBracket, faUserTie, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { CaseRecord } from "../lib/types";
import { SeverityBadge } from "./CaseBadge";
import { EvidencePreview, type EvidenceFile } from "./EvidencePreview";

type DirectorDetail = {
  case: CaseRecord & Record<string, unknown> & { advisor_names?: string[] };
  timeline: Array<Record<string, string>>;
  actions: Array<Record<string, string>>;
  attachments: EvidenceFile[];
};

export function DirectorDashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<DirectorDetail | null>(null);
  const [previewFile, setPreviewFile] = useState<EvidenceFile | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const critical = useMemo(() => cases.filter((item) => item.severity === "CRITICAL").length, [cases]);

  async function loadCases() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/director/cases");
      if (response.status === 401) {
        window.location.href = "/director/login";
        return;
      }
      const data = await response.json() as { cases?: CaseRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถโหลดข้อมูลได้");
      setCases(data.cases ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  async function openCase(caseNumber: string) {
    const response = await fetch(`/api/director/cases/${caseNumber}`);
    const data = await response.json() as DirectorDetail & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "ไม่สามารถเปิดเคสได้");
      return;
    }
    setSelected(data);
    setMessage("");
  }

  async function act(action: "ACKNOWLEDGED" | "ORDER" | "RETURN_TO_ADMIN" | "RESOLVE") {
    if (!selected || message.trim().length < 2) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/director/cases/${selected.case.case_number}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setSelected(null);
      setMessage("");
      await loadCases();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/director/login";
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadCases, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className="director-page">
    <aside className="director-sidebar">
      <Link className="admin-brand" href="/"><img className="school-logo" src="/images/chomthong-logo.png" width={52} height={52} alt="ตราโรงเรียนจอมทอง" /><span><b>กล่องแดง</b><small>DIRECTOR</small></span></Link>
      <nav><span className="nav-label">สำหรับผู้บริหาร</span><button className="active"><FontAwesomeIcon icon={faUserTie} /> เคสรอพิจารณา <b>{cases.length}</b></button><button onClick={loadCases}><FontAwesomeIcon icon={faRotate} /> รีเฟรชข้อมูล</button></nav>
      <div className="sidebar-profile"><span>ผอ.</span><div><b>ผู้อำนวยการ</b><small>DIRECTOR</small></div><button className="director-logout" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ"><FontAwesomeIcon icon={faRightFromBracket} /></button></div>
    </aside>
    <main className="director-main">
      <header className="management-header"><div><span className="eyebrow"><FontAwesomeIcon icon={faGavel} /> ศูนย์พิจารณาเคส</span><h1>Dashboard ผู้อำนวยการ</h1><p>แสดงเฉพาะเคสที่เจ้าหน้าที่คัดกรองและเสนอมาแล้ว</p></div><div className="director-summary"><span><FontAwesomeIcon icon={faFolderOpen} /> รอพิจารณา <b>{cases.length}</b></span><span className="danger"><FontAwesomeIcon icon={faCircleInfo} /> เร่งด่วน <b>{critical}</b></span></div></header>
      <section className="management-card">
        {loading ? <div className="table-skeleton"><span /><span /><span /></div> : error ? <div className="empty-state"><h3>โหลดข้อมูลไม่สำเร็จ</h3><p>{error}</p><button className="button secondary" onClick={loadCases}>ลองอีกครั้ง</button></div> : cases.length === 0 ? <div className="empty-state"><FontAwesomeIcon icon={faCheck} /><h3>ไม่มีเคสรอพิจารณา</h3><p>เคสจะแสดงที่นี่หลังเจ้าหน้าที่กดเสนอผู้อำนวยการ</p></div> : <div className="case-table-wrap"><table className="case-table"><thead><tr><th>Case ID</th><th>หัวข้อ</th><th>ประเภท</th><th>ความสำคัญ</th><th>ผู้แจ้ง</th><th></th></tr></thead><tbody>{cases.map((item) => <tr key={item.id} onClick={() => openCase(item.case_number)}><td><b>{item.case_number}</b></td><td>{item.title}</td><td>{item.category_name}</td><td><SeverityBadge value={item.severity} /></td><td><span className="case-reporter"><b>{item.reporter_name}</b>{item.level && item.classroom && <small>{item.level}/{item.classroom}</small>}</span></td><td>เปิดดู</td></tr>)}</tbody></table></div>}
      </section>
    </main>
    {selected && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="case-drawer"><header><div><small>เคสเสนอผู้อำนวยการ</small><h2>{String(selected.case.case_number)}</h2></div><button onClick={() => setSelected(null)} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button></header><div className="drawer-body"><SeverityBadge value={String(selected.case.severity)} /><h3>{String(selected.case.title)}</h3><p className="case-description">{String(selected.case.description)}</p><div className="detail-grid"><div><small>ประเภท</small><b>{String(selected.case.category_name)}</b></div><div><small>ผู้แจ้ง</small><b>{String(selected.case.reporter_name)}</b></div><div><small>ชั้น / ห้อง</small><b>{String(selected.case.level ?? "-")}/{String(selected.case.classroom ?? "-")}</b></div><div><small>ครูที่ปรึกษา</small><b>{selected.case.advisor_names?.length ? selected.case.advisor_names.join(" / ") : "ยังไม่ได้กำหนดครูที่ปรึกษา"}</b></div><div><small>ผู้รับผิดชอบ</small><b>{String(selected.case.assigned_to || "ยังไม่ได้มอบหมาย")}</b></div><div><small>วันที่แจ้ง</small><b>{new Date(String(selected.case.created_at)).toLocaleString("th-TH")}</b></div></div><section className="note-card"><h4>ไฟล์หลักฐาน</h4>{selected.attachments.length === 0 ? <p className="muted-text">ไม่ได้แนบหลักฐาน</p> : <div className="attachment-list">{selected.attachments.map((file) => <button type="button" key={file.id} onClick={() => setPreviewFile(file)}><FontAwesomeIcon icon={faFolderOpen} /><span>{file.original_name}</span><small>{(file.file_size / 1024 / 1024).toFixed(2)} MB</small></button>)}</div>}</section><section className="director-action-card"><h4>คำสั่งผู้อำนวยการ</h4><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="ระบุคำสั่ง ความเห็น หรือเหตุผล" /><div><button disabled={saving || message.trim().length < 2} onClick={() => act("ACKNOWLEDGED")}><FontAwesomeIcon icon={faCheck} /> รับทราบ</button><button disabled={saving || message.trim().length < 2} onClick={() => act("ORDER")}><FontAwesomeIcon icon={faGavel} /> สั่งการ</button><button disabled={saving || message.trim().length < 2} onClick={() => act("RETURN_TO_ADMIN")}><FontAwesomeIcon icon={faRotate} /> ส่งกลับแอดมิน</button><button className="success" disabled={saving || message.trim().length < 2} onClick={() => act("RESOLVE")}><FontAwesomeIcon icon={faCheck} /> ให้ปิดเรื่อง</button></div></section><section className="timeline-card"><h4><FontAwesomeIcon icon={faClock} /> Timeline</h4>{selected.timeline.map((item) => <div className="timeline-item" key={item.id}><span /><div><b>{item.title}</b><p>{item.description}</p><small>{item.created_by}</small></div></div>)}</section></div></aside></div>}
    <EvidencePreview file={previewFile} onClose={() => setPreviewFile(null)} />
  </div>;
}
