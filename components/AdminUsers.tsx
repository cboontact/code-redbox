"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleExclamation, faFloppyDisk, faKey, faLink, faLock, faMagnifyingGlass, faPen, faPlus, faShieldHalved, faUserCheck, faUserSlash, faUserTie, faUsersGear, faXmark } from "@fortawesome/free-solid-svg-icons";

type Role = "SUPER_ADMIN" | "INTAKE" | "STUDENT_AFFAIRS" | "LEVEL_HEAD" | "TEACHER" | "ADVISOR" | "DEPUTY_DIRECTOR" | "DIRECTOR";
type StaffUser = { id: string; username: string; display_name: string; role: Role; roles: Role[]; advisor_id: string | null; advisor_name: string | null; is_active: number; created_at: string };
type Advisor = { id: string; prefix: string; first_name: string; last_name: string; source_username?: string | null; account_user_id?: string | null; account_username?: string | null };

const roles: Array<{ value: Role; label: string; detail: string }> = [
  { value: "SUPER_ADMIN", label: "แอดมินระบบ", detail: "ควบคุมทุกส่วนและจัดการผู้ใช้งาน" },
  { value: "INTAKE", label: "เจ้าหน้าที่รับเรื่อง", detail: "คัดกรอง ส่งทีมกิจการ ตรวจผล และปิดเคส" },
  { value: "STUDENT_AFFAIRS", label: "ครูกิจการนักเรียน", detail: "พิจารณาอนุมัติและมอบหมายทีมครู" },
  { value: "LEVEL_HEAD", label: "หัวหน้าระดับ", detail: "รับมอบหมายและร่วมดำเนินการเคส" },
  { value: "TEACHER", label: "ครูผู้ดำเนินการ", detail: "รับมอบหมายและบันทึกผลการดำเนินงาน" },
  { value: "ADVISOR", label: "ครูที่ปรึกษา", detail: "ดูเคสของนักเรียนในห้องที่ได้รับสิทธิ์" },
  { value: "DEPUTY_DIRECTOR", label: "รองผู้อำนวยการ", detail: "พิจารณาเคสรุนแรงหรือวิกฤต" },
  { value: "DIRECTOR", label: "ผู้อำนวยการ", detail: "พิจารณาเฉพาะเคสที่เสนอขึ้นมา" },
];

const emptyForm = { username: "", password: "", displayName: "", roles: ["INTAKE"] as Role[], advisorId: "" };

export function AdminUsers() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);

  async function load() {
    const response = await fetch("/api/admin/users");
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    if (response.status === 403) { window.location.href = "/admin"; return; }
    const data = await response.json() as { users?: StaffUser[]; error?: string };
    if (!response.ok) throw new Error(data.error);
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch(() => showToast("ไม่สามารถโหลดบัญชีผู้ใช้ได้", "error"));
      fetch("/api/advisors").then(async (response) => await response.json() as { advisors?: Advisor[] }).then((data) => {
        const nextAdvisors = data.advisors ?? [];
        setAdvisors(nextAdvisors);
        const requestedAdvisorId = new URLSearchParams(window.location.search).get("advisorId");
        if (!requestedAdvisorId) return;
        const advisor = nextAdvisors.find((item) => item.id === requestedAdvisorId);
        if (!advisor) { showToast("ไม่พบข้อมูลครูที่ปรึกษาที่เลือก", "error"); return; }
        if (advisor.account_user_id) { showToast(`ครูคนนี้มีบัญชี @${advisor.account_username} แล้ว`, "error"); return; }
        setEditing(null);
        setForm({ username: advisor.source_username ?? "", password: "", displayName: `${advisor.prefix}${advisor.first_name} ${advisor.last_name}`, roles: ["ADVISOR"], advisorId: advisor.id });
        setOpen(true);
      }).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, saving]);

  const visible = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.display_name} ${user.username} ${user.advisor_name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!roleFilter || user.roles.includes(roleFilter as Role));
  }), [users, search, roleFilter]);
  const activeCount = users.filter((user) => user.is_active).length;
  const advisorAccountCount = users.filter((user) => user.roles.includes("ADVISOR") && user.advisor_id && user.is_active).length;
  const inactiveCount = users.filter((user) => !user.is_active).length;
  const selectableAdvisors = advisors.filter((advisor) => !advisor.account_user_id || advisor.account_user_id === editing?.id);

  function createUser() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function editUser(user: StaffUser) { setEditing(user); setForm({ username: user.username, password: "", displayName: user.display_name, roles: user.roles, advisorId: user.advisor_id ?? "" }); setOpen(true); }
  function toggleRole(role: Role) {
    const selected = form.roles.includes(role);
    if (selected && form.roles.length === 1) return;
    const nextRoles = selected ? form.roles.filter((item) => item !== role) : [...form.roles, role];
    setForm({ ...form, roles: nextRoles, advisorId: nextRoles.includes("ADVISOR") ? form.advisorId : "" });
  }
  function roleNames(values: Role[]) {
    return values.map((value) => roles.find((role) => role.value === value)?.label ?? value).join(" · ");
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(editing ? `/api/admin/users/${editing.id}` : "/api/admin/users", {
        method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { displayName: form.displayName, roles: form.roles, advisorId: form.roles.includes("ADVISOR") ? form.advisorId || null : null, ...(form.password ? { password: form.password } : {}) } : { ...form, advisorId: form.roles.includes("ADVISOR") ? form.advisorId || null : null }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setOpen(false); await load(); showToast(editing ? "บันทึกการแก้ไขบัญชีแล้ว" : "สร้างบัญชีผู้ใช้งานแล้ว");
    } catch (error) { showToast(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ", "error"); }
    finally { setSaving(false); }
  }

  async function toggle(user: StaffUser) {
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !user.is_active }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { showToast(data.error ?? "เปลี่ยนสถานะไม่สำเร็จ", "error"); return; }
    await load(); showToast(user.is_active ? "ปิดการใช้งานบัญชีแล้ว" : "เปิดการใช้งานบัญชีแล้ว");
  }

  return <main className="management-page"><header className="management-header"><div><span className="eyebrow"><FontAwesomeIcon icon={faShieldHalved} /> สิทธิ์และความปลอดภัย</span><h1>จัดการผู้ใช้งาน</h1><p>หนึ่งบัญชีเลือกได้หลายบทบาท ใช้ Username และรหัสผ่านชุดเดียว</p></div><button className="button primary" onClick={createUser}><FontAwesomeIcon icon={faPlus} /> เพิ่มผู้ใช้งาน</button></header>
    <section className="management-summary user-role-summary"><article><FontAwesomeIcon icon={faUserCheck} /><div><b>{activeCount}</b><small>บัญชีที่ใช้งาน</small></div></article><article><FontAwesomeIcon icon={faUserTie} /><div><b>{advisorAccountCount}</b><small>บัญชีครูที่เชื่อมแล้ว</small></div></article><article><FontAwesomeIcon icon={faUserSlash} /><div><b>{inactiveCount}</b><small>บัญชีที่ปิดใช้งาน</small></div></article></section>
    <section className="management-card user-management-card"><div className="user-list-heading"><div><h2>บัญชีผู้ใช้งาน</h2><p>แต่ละบัญชีมีหลายหน้าที่ได้ โดยเชื่อมข้อมูลครูเพียงครั้งเดียว</p></div><strong>{visible.length} จาก {users.length} บัญชี</strong></div><div className="advisor-filter-bar"><label className="advisor-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ Username หรือครูที่เชื่อม" /></label><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">ทุกบทบาท</option>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
      <div className="user-list">{visible.length === 0 ? <div className="empty-state"><FontAwesomeIcon icon={faUsersGear} /><h3>ไม่พบบัญชีผู้ใช้งาน</h3><p>ลองเปลี่ยนคำค้นหาหรือตัวกรองบทบาท</p></div> : visible.map((user) => { const protectedAccount = user.username === "cboonta"; return <article key={user.id} className={!user.is_active ? "inactive" : ""}><span className="user-avatar">{user.display_name.slice(0, 1)}</span><div className="user-identity"><b>{user.display_name}</b><small>@{user.username}</small>{protectedAccount && <span className="protected-account"><FontAwesomeIcon icon={faLock} /> ผู้ดูแลสูงสุด</span>}{user.advisor_name && <span className="linked-person"><FontAwesomeIcon icon={faLink} /> {user.advisor_name}</span>}</div><div className="user-role"><div className="user-role-tags">{user.roles.map((value) => <span key={value}>{roles.find((role) => role.value === value)?.label ?? value}</span>)}</div><small>{protectedAccount ? "เข้าถึงทุกส่วนและไม่สามารถลดสิทธิ์ได้" : `${user.roles.length} บทบาทในบัญชีเดียว`}</small></div><div className="user-actions"><button className="edit-user" onClick={() => editUser(user)} disabled={protectedAccount} title={protectedAccount ? "บัญชีผู้ดูแลสูงสุดถูกป้องกัน" : "กำหนดบทบาทและข้อมูลบัญชี"} aria-label={`กำหนดสิทธิ์ ${user.display_name}`}><FontAwesomeIcon icon={protectedAccount ? faLock : faShieldHalved} /><span>{protectedAccount ? "บัญชีหลัก" : "กำหนดสิทธิ์"}</span></button><button type="button" role="switch" aria-checked={Boolean(user.is_active)} aria-label={`${user.is_active ? "ปิด" : "เปิด"}ใช้งานบัญชี ${user.display_name}`} className={`account-toggle ${user.is_active ? "on" : "off"}`} onClick={() => toggle(user)} disabled={protectedAccount} title={protectedAccount ? "บัญชีผู้ดูแลสูงสุดเปิดใช้งานถาวร" : user.is_active ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}><span className="toggle-track"><span /></span></button></div></article>; })}</div>
    </section>
    {open && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}><section className="student-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"><form onSubmit={save}>
      <header className="student-modal-header"><div><span className="student-modal-icon"><FontAwesomeIcon icon={editing ? faPen : faPlus} /></span><div><small><FontAwesomeIcon icon={faKey} /> บัญชีและสิทธิ์</small><h2 id="user-modal-title">{editing ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h2></div></div><button type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="ปิด Modal"><FontAwesomeIcon icon={faXmark} /></button></header>
      <div className="student-modal-body user-modal-body"><p className="student-modal-help">เลือกได้มากกว่า 1 บทบาท โดยผู้ใช้เข้าสู่ระบบด้วยบัญชีเดียว</p><div className="user-form-grid">
        <label><span>ชื่อที่แสดง</span><input autoFocus value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="ชื่อบุคลากรหรือชื่องาน" required /></label>
        <label><span>Username</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="ชื่อสำหรับเข้าสู่ระบบ" disabled={Boolean(editing)} required /></label>
        <label><span>{editing ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่าน"}</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? "เว้นว่างหากไม่เปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"} minLength={8} required={!editing} /></label>
        <fieldset className="role-picker"><legend>กำหนดบทบาท <small>เลือกได้หลายรายการ</small></legend><div>{roles.map((role) => { const selected = form.roles.includes(role.value); return <button type="button" key={role.value} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleRole(role.value)}><span><FontAwesomeIcon icon={role.value === "SUPER_ADMIN" ? faShieldHalved : ["DIRECTOR", "DEPUTY_DIRECTOR"].includes(role.value) ? faUserTie : role.value === "ADVISOR" ? faLink : ["LEVEL_HEAD", "TEACHER", "STUDENT_AFFAIRS"].includes(role.value) ? faUserCheck : faKey} /></span><div><b>{role.label}</b><small>{role.detail}</small></div>{selected && <FontAwesomeIcon className="role-selected-check" icon={faCircleCheck} />}</button>; })}</div></fieldset>
        {form.roles.includes("ADVISOR") && <label className="advisor-account-link"><span>เชื่อมกับข้อมูลครูที่ปรึกษา</span><select value={form.advisorId} onChange={(event) => { const advisor = advisors.find((item) => item.id === event.target.value); setForm({ ...form, advisorId: event.target.value, ...(!editing && advisor ? { displayName: `${advisor.prefix}${advisor.first_name} ${advisor.last_name}`, username: form.username || advisor.source_username || "" } : {}) }); }} required><option value="">เลือกครูที่ยังไม่มีบัญชี</option>{selectableAdvisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.prefix}{advisor.first_name} {advisor.last_name}{advisor.account_username ? ` · @${advisor.account_username}` : ""}</option>)}</select><small className="field-help">เชื่อมครูหนึ่งครั้ง แล้วเพิ่มบทบาทอื่นในบัญชีเดียวกันได้</small></label>}
        {editing && roleNames(editing.roles) !== roleNames(form.roles) && <div className="role-change-notice"><FontAwesomeIcon icon={faCircleExclamation} /><span><b>กำลังปรับบทบาทของบัญชี</b><small>{roleNames(editing.roles)} → {roleNames(form.roles)}</small></span></div>}
        {form.roles.includes("SUPER_ADMIN") && <div className="role-warning"><FontAwesomeIcon icon={faShieldHalved} /><span><b>สิทธิ์ระดับสูงสุด</b><small>บทบาทนี้ครอบคลุมทุกส่วน รวมถึงจัดการผู้ใช้ ลบเคส และเปลี่ยนสิทธิ์</small></span></div>}
      </div></div>
      <footer className="student-modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? "กำลังบันทึก..." : "บันทึกผู้ใช้งาน"}</button></footer>
    </form></section></div>}
    {toast && <div className={`admin-toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"}><FontAwesomeIcon icon={toast.type === "error" ? faCircleExclamation : faCircleCheck} /><span>{toast.text}</span><button type="button" onClick={() => setToast(null)} aria-label="ปิดการแจ้งเตือน"><FontAwesomeIcon icon={faXmark} /></button></div>}
  </main>;
}
