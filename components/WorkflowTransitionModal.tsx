"use client";

import { FormEvent, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faClock, faPaperPlane, faXmark } from "@fortawesome/free-solid-svg-icons";

export function WorkflowTransitionModal({ fromLabel, toLabel, saving, onClose, onConfirm }: {
  fromLabel: string; toLabel: string; saving: boolean; onClose: () => void;
  onConfirm: (reason: string, dueDate: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); onConfirm(reason, dueDate); }
  return <div className="modal-backdrop workflow-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
      <header><div><span className="eyebrow"><FontAwesomeIcon icon={faPaperPlane} /> ส่งต่อเคส</span><h2 id="workflow-modal-title">ยืนยันขั้นตอนถัดไป</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button></header>
      <div className="workflow-route"><b>{fromLabel}</b><FontAwesomeIcon icon={faArrowRight} /><b>{toLabel}</b></div>
      <form onSubmit={submit}><label><span>เหตุผล คำสั่ง หรือผลการดำเนินงาน</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} minLength={2} maxLength={1000} autoFocus required placeholder="ระบุรายละเอียดให้ผู้รับช่วงต่อเข้าใจงาน..." /></label><label><span><FontAwesomeIcon icon={faClock} /> กำหนดติดตาม (ถ้ามี)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><footer><button type="button" className="button secondary" onClick={onClose} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving || reason.trim().length < 2}>{saving ? "กำลังส่งต่อ..." : "ยืนยันส่งต่อ"}</button></footer></form>
    </section>
  </div>;
}
