"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated R2 previews use dynamic object URLs. */

import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand, faFilePdf, faImage, faXmark } from "@fortawesome/free-solid-svg-icons";

export type EvidenceFile = {
  id: string;
  original_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
};

export function EvidencePreview({ file, onClose }: { file: EvidenceFile | null; onClose: () => void }) {
  useEffect(() => {
    if (!file) return;
    const previousOverflow = document.body.style.overflow;
    const ownsScrollLock = previousOverflow !== "hidden";
    if (ownsScrollLock) document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      if (ownsScrollLock) document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [file, onClose]);

  if (!file) return null;
  const source = `/api/uploads?key=${encodeURIComponent(file.storage_key)}&preview=1`;
  const isPdf = file.mime_type === "application/pdf";

  return <div className="evidence-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="evidence-preview-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-preview-title">
      <header><div><span><FontAwesomeIcon icon={isPdf ? faFilePdf : faImage} /></span><div><small>ตัวอย่างไฟล์หลักฐาน</small><h2 id="evidence-preview-title">{file.original_name}</h2></div></div><div><a href={source} target="_blank" rel="noreferrer" aria-label="เปิดไฟล์เต็มหน้าจอ" title="เปิดเต็มหน้าจอ"><FontAwesomeIcon icon={faExpand} /></a><button type="button" onClick={onClose} aria-label="ปิดตัวอย่างไฟล์"><FontAwesomeIcon icon={faXmark} /></button></div></header>
      <div className={`evidence-preview-content ${isPdf ? "pdf" : "image"}`}>{isPdf ? <iframe src={source} title={`ตัวอย่าง ${file.original_name}`} /> : <img src={source} alt={`หลักฐาน ${file.original_name}`} />}</div>
    </section>
  </div>;
}
