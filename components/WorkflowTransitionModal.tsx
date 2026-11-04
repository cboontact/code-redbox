"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faClock, faEyeSlash, faPaperPlane, faUserShield, faXmark } from "@fortawesome/free-solid-svg-icons";

export function WorkflowTransitionModal({ fromLabel, toLabel, recipientLabel, closing = false, reassignment = false, saving, onClose, onConfirm }: {
  fromLabel: string; toLabel: string; recipientLabel?: string; closing?: boolean; reassignment?: boolean; saving: boolean; onClose: () => void;
  onConfirm: (reason: string, dueDate: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  function submit(event: FormEvent) { event.preventDefault(); onConfirm(reason, dueDate); }
  if (!mounted) return null;

  return createPortal(<div className="modal-backdrop workflow-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
      <header><div><span className="eyebrow"><FontAwesomeIcon icon={faPaperPlane} /> ส่งต่อเคส</span><h2 id="workflow-modal-title">{reassignment ? "ยืนยันผู้รับผิดชอบคนใหม่" : "ยืนยันขั้นตอนถัดไป"}</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button></header>
      <div className="workflow-route"><b>{fromLabel}</b><FontAwesomeIcon icon={faArrowRight} /><b>{toLabel}</b></div>
      <form onSubmit={submit}>
        {recipientLabel && <div className="workflow-recipient"><FontAwesomeIcon icon={faUserShield} /><span><small>ส่งงานและคำสั่งถึง</small><b>{recipientLabel}</b></span></div>}
        <div className="workflow-audience-note"><FontAwesomeIcon icon={faEyeSlash} /><span><b>สรุปนี้จะแสดงในไทม์ไลน์ของเคส</b><small>ใช้บอกเหตุผล ผลการพิจารณา หรือคำสั่งแก่ผู้รับช่วงต่อ ต่างจากบันทึกภายในที่ใช้จดข้อมูลระหว่างทำงาน นักเรียนไม่เห็นข้อความนี้</small></span></div>
        <label><span>{recipientLabel ? "สรุปขั้นตอนหรือคำสั่งสำหรับผู้รับช่วงต่อ (ถ้ามี)" : closing ? "สรุปผลก่อนปิดเคส (ถ้ามี)" : "เหตุผลหรือสรุปผลของขั้นตอนนี้ (ถ้ามี)"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} autoFocus placeholder={recipientLabel ? `พิมพ์สิ่งที่ต้องการให้ ${recipientLabel} ดำเนินการ หรือเว้นว่างได้` : closing ? "พิมพ์สรุปผล หรือเว้นว่างได้" : "พิมพ์รายละเอียดเพิ่มเติม หรือเว้นว่างได้"} /></label>
        <label><span><FontAwesomeIcon icon={faClock} /> กำหนดติดตาม (ถ้ามี)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <footer><button type="button" className="button secondary" onClick={onClose} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving}>{saving ? (closing ? "กำลังปิดเคส..." : "กำลังส่งต่อ...") : closing ? "ยืนยันปิดเคส" : reassignment ? "ยืนยันส่งต่อผู้รับผิดชอบ" : recipientLabel ? "ยืนยันมอบหมายและส่งต่อ" : "ยืนยันส่งต่อ"}</button></footer>
      </form>
    </section>
  </div>, document.body);
}
