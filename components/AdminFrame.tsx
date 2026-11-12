"use client";
/* eslint-disable @next/next/no-img-element -- Local static school logo does not require an image optimization service. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine, faCircleCheck, faCircleExclamation, faFloppyDisk, faKey, faRightFromBracket, faShieldHalved, faUserGraduate, faUserTie, faUsersGear, faXmark } from "@fortawesome/free-solid-svg-icons";

type CurrentUser = { username: string; displayName: string; role: string; roles?: string[]; mustChangePassword?: boolean };

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "แอดมินระบบ", INTAKE: "เจ้าหน้าที่รับเรื่อง", STUDENT_AFFAIRS: "ครูกิจการนักเรียน",
  LEVEL_HEAD: "หัวหน้าระดับ", TEACHER: "ครูผู้ดำเนินการ", ADVISOR: "ครูที่ปรึกษา",
  DEPUTY_DIRECTOR: "รองผู้อำนวยการ", DIRECTOR: "ผู้อำนวยการ", CASE_OFFICER: "ผู้รับผิดชอบเคส (เดิม)",
};

const menu = [
  { href: "/admin", label: "Dashboard", icon: faChartLine, superAdminOnly: false },
  { href: "/admin/students", label: "นักเรียน", icon: faUserGraduate, superAdminOnly: true },
  { href: "/admin/advisors", label: "ครูที่ปรึกษา", icon: faUserTie, superAdminOnly: true },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน", icon: faUsersGear, superAdminOnly: true },
];

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/auth/me").then(async (response) => {
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await response.json() as { user?: CurrentUser };
      setCurrentUser(data.user ?? null);
      if (data.user?.mustChangePassword) setPasswordOpen(true);
    }).catch(() => undefined);
  }, [pathname]);

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { window.location.href = "/admin/login"; }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (pathname === "/admin/login") return children;

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) { setToast({ text: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", type: "error" }); return; }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next }) });
      // A gateway or runtime failure can return a non-JSON page; show the status instead of a parse error.
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `เปลี่ยนรหัสผ่านไม่สำเร็จ (รหัสตอบกลับ ${response.status})`);
      setPasswordOpen(false); setPasswordForm({ current: "", next: "", confirm: "" });
      setCurrentUser((user) => user ? { ...user, mustChangePassword: false } : user);
      setToast({ text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", type: "success" });
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) { setToast({ text: error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ", type: "error" }); }
    finally { setSavingPassword(false); }
  }

  return <div className="admin-frame">
    <aside className="main-admin-sidebar">
      <Link className="admin-brand" href="/"><img className="school-logo" src="/images/chomthong-logo.png" width={52} height={52} alt="ตราโรงเรียนจอมทอง" /><span><b>กล่องแดง</b><small>โรงเรียนจอมทอง</small></span></Link>
      <nav aria-label="เมนูผู้ดูแลระบบ"><span className="nav-label">เมนูหลัก</span>{menu.filter((item) => !item.superAdminOnly || currentUser?.roles?.includes("SUPER_ADMIN") || currentUser?.role === "SUPER_ADMIN").map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}><FontAwesomeIcon icon={item.icon} /> {item.label}</Link>)}</nav>
      <div className="sidebar-profile"><span>{currentUser?.displayName?.slice(0, 1) ?? "จ"}</span><div><b>{currentUser?.displayName ?? "เจ้าหน้าที่"}</b><small>{(currentUser?.roles ?? [currentUser?.role]).filter((role) => role && !["ADVISOR", "TEACHER", "CASE_OFFICER"].includes(role)).map((role) => roleLabels[role ?? ""] ?? role).join(" · ") || "บัญชีบุคลากร"}</small></div>{currentUser?.username !== "cboonta" && <button type="button" className="profile-password-button" onClick={() => setPasswordOpen(true)} aria-label="เปลี่ยนรหัสผ่าน" title="เปลี่ยนรหัสผ่าน"><FontAwesomeIcon icon={faKey} /></button>}<button type="button" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ"><FontAwesomeIcon icon={faRightFromBracket} /></button></div>
    </aside>
    <div className="admin-frame-content">{children}</div>
    {passwordOpen && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingPassword && !currentUser?.mustChangePassword) setPasswordOpen(false); }}><section className="student-modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title"><form onSubmit={changePassword}><header className="student-modal-header"><div><span className="student-modal-icon"><FontAwesomeIcon icon={faShieldHalved} /></span><div><small><FontAwesomeIcon icon={faKey} /> ความปลอดภัยของบัญชี</small><h2 id="password-modal-title">{currentUser?.mustChangePassword ? "ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน" : "เปลี่ยนรหัสผ่าน"}</h2></div></div>{!currentUser?.mustChangePassword && <button type="button" onClick={() => setPasswordOpen(false)} disabled={savingPassword} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button>}</header><div className="student-modal-body"><p className="student-modal-help">{currentUser?.mustChangePassword ? "บัญชีนี้ยังใช้รหัสเริ่มต้น กรุณาเปลี่ยนเป็นรหัสส่วนตัวอย่างน้อย 8 ตัวอักษรก่อนเข้าใช้งานระบบ" : "กรอกรหัสผ่านเดิมก่อนตั้งรหัสใหม่ รหัสใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"}</p><div className="password-form-grid"><label><span>รหัสผ่านเดิม</span><input type="password" autoComplete="current-password" value={passwordForm.current} onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })} required autoFocus /></label><label><span>รหัสผ่านใหม่</span><input type="password" autoComplete="new-password" minLength={8} value={passwordForm.next} onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })} required /></label><label><span>ยืนยันรหัสผ่านใหม่</span><input type="password" autoComplete="new-password" minLength={8} value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} required /></label>{passwordForm.confirm && passwordForm.next !== passwordForm.confirm && <small className="password-mismatch">รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน</small>}</div></div><footer className="student-modal-actions">{!currentUser?.mustChangePassword && <button type="button" className="button secondary" onClick={() => setPasswordOpen(false)} disabled={savingPassword}>ยกเลิก</button>}<button className="button primary" disabled={savingPassword || passwordForm.next.length < 8 || passwordForm.next !== passwordForm.confirm}><FontAwesomeIcon icon={faFloppyDisk} /> {savingPassword ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}</button></footer></form></section></div>}
    {toast && <div className={`admin-toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"}><FontAwesomeIcon icon={toast.type === "error" ? faCircleExclamation : faCircleCheck} /><span>{toast.text}</span><button type="button" onClick={() => setToast(null)} aria-label="ปิดการแจ้งเตือน"><FontAwesomeIcon icon={faXmark} /></button></div>}
  </div>;
}
