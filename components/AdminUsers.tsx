"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleExclamation, faEye, faEyeSlash, faFloppyDisk, faKey, faLink, faLock, faMagnifyingGlass, faPen, faPlus, faShieldHalved, faTrashCan, faTriangleExclamation, faUserCheck, faUserMinus, faUserSlash, faUserTie, faUsersGear, faXmark } from "@fortawesome/free-solid-svg-icons";

type Role = "SUPER_ADMIN" | "INTAKE" | "STUDENT_AFFAIRS" | "LEVEL_HEAD" | "TEACHER" | "ADVISOR" | "DEPUTY_DIRECTOR" | "DIRECTOR";
type StaffUser = { id: string; username: string; display_name: string; role: Role; roles: Role[]; advisor_id: string | null; advisor_name: string | null; can_view_student_identity: number; is_active: number; created_at: string };
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

const emptyForm = { username: "", password: "", displayName: "", roles: ["INTAKE"] as Role[], advisorId: "", canViewStudentIdentity: false };

function linkedAdvisorLabel(user: StaffUser) {
  if (!user.advisor_name) return null;
  const accountName = user.display_name.replace(/\s+/g, "").toLocaleLowerCase("th");
  const advisorName = user.advisor_name.replace(/\s+/g, "").toLocaleLowerCase("th");
  return accountName === advisorName ? "เชื่อมข้อมูลครูที่ปรึกษาแล้ว" : `เชื่อมกับ ${user.advisor_name}`;
}

export function AdminUsers() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [removingRole, setRemovingRole] = useState<{ user: StaffUser; role: Role } | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
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
        setForm({ username: advisor.source_username ?? "", password: "", displayName: `${advisor.prefix}${advisor.first_name} ${advisor.last_name}`, roles: ["ADVISOR"], advisorId: advisor.id, canViewStudentIdentity: false });
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
    const matchesTab = !roleFilter
      || (roleFilter === "IDENTITY_ACCESS" ? Boolean(user.is_active) && (Boolean(user.can_view_student_identity) || user.roles.includes("SUPER_ADMIN")) : user.roles.includes(roleFilter as Role));
    return matchesSearch && matchesTab;
  }), [users, search, roleFilter]);
  const activeCount = users.filter((user) => user.is_active).length;
  const advisorAccountCount = users.filter((user) => user.roles.includes("ADVISOR") && user.advisor_id && user.is_active).length;
  const inactiveCount = users.filter((user) => !user.is_active).length;
  const identityAccessCount = users.filter((user) => user.is_active && (user.can_view_student_identity || user.roles.includes("SUPER_ADMIN"))).length;
  const selectableAdvisors = advisors.filter((advisor) => !advisor.account_user_id || advisor.account_user_id === editing?.id);

  function createUser() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function editUser(user: StaffUser) { setEditing(user); setForm({ username: user.username, password: "", displayName: user.display_name, roles: user.roles, advisorId: user.advisor_id ?? "", canViewStudentIdentity: Boolean(user.can_view_student_identity) }); setOpen(true); }
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
        body: JSON.stringify(editing ? { displayName: form.displayName, roles: form.roles, advisorId: form.roles.includes("ADVISOR") ? form.advisorId || null : null, canViewStudentIdentity: form.canViewStudentIdentity, ...(form.password ? { password: form.password } : {}) } : { ...form, advisorId: form.roles.includes("ADVISOR") ? form.advisorId || null : null }),
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

  async function deleteUser() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${deleting.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "ลบบัญชีไม่สำเร็จ");
      setDeleting(null); await load(); showToast("ลบบัญชีผู้ใช้งานแล้ว");
    } catch (error) { showToast(error instanceof Error ? error.message : "ลบบัญชีไม่สำเร็จ", "error"); }
    finally { setDeleteBusy(false); }
  }

  async function removeSelectedRole() {
    if (!removingRole) return;
    if (removingRole.user.roles.length <= 1) {
      setRemovingRole(null);
      showToast("บัญชีต้องมีอย่างน้อย 1 บทบาท กรุณาเพิ่มบทบาทอื่นก่อน หรือเลือกลบบัญชีทั้งหมดจากหน้าแก้ไข", "error");
      return;
    }
    setRoleBusy(true);
    try {
      const nextRoles = removingRole.user.roles.filter((role) => role !== removingRole.role);
      const response = await fetch(`/api/admin/users/${removingRole.user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles: nextRoles }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "นำบทบาทออกไม่สำเร็จ");
      const removedLabel = roles.find((role) => role.value === removingRole.role)?.label ?? removingRole.role;
      setRemovingRole(null); await load(); showToast(`นำบทบาท ${removedLabel} ออกจากบัญชีแล้ว`);
    } catch (error) { showToast(error instanceof Error ? error.message : "นำบทบาทออกไม่สำเร็จ", "error"); }
    finally { setRoleBusy(false); }
  }

  return <main className="management-page"><header className="management-header"><div><span className="eyebrow"><FontAwesomeIcon icon={faShieldHalved} /> สิทธิ์และความปลอดภัย</span><h1>จัดการผู้ใช้งาน</h1><p>หนึ่งบัญชีเลือกได้หลายบทบาท ใช้ Username และรหัสผ่านชุดเดียว</p></div><button className="button primary" onClick={createUser}><FontAwesomeIcon icon={faPlus} /> เพิ่มผู้ใช้งาน</button></header>
    <section className="management-summary user-role-summary"><article><FontAwesomeIcon icon={faUserCheck} /><div><b>{activeCount}</b><small>บัญชีที่ใช้งาน</small></div></article><article><FontAwesomeIcon icon={faUserTie} /><div><b>{advisorAccountCount}</b><small>บัญชีครูที่เชื่อมแล้ว</small></div></article><article><FontAwesomeIcon icon={faEye} /><div><b>{identityAccessCount}</b><small>ผู้มีสิทธิ์ดูตัวตน</small></div></article><article><FontAwesomeIcon icon={faUserSlash} /><div><b>{inactiveCount}</b><small>บัญชีที่ปิดใช้งาน</small></div></article></section>
    <section className="management-card user-management-card"><div className="user-list-heading"><div><h2>บัญชีผู้ใช้งานตามบทบาท</h2><p>เลือกแท็บเพื่อดูว่าแต่ละบทบาทมีใครบ้าง หนึ่งบัญชีจึงปรากฏได้หลายแท็บ</p></div><strong>{visible.length} จาก {users.length} บัญชี</strong></div>
      <div className="user-role-tabs" role="tablist" aria-label="กรองผู้ใช้งานตามบทบาท"><button type="button" role="tab" aria-selected={!roleFilter} className={!roleFilter ? "active" : ""} onClick={() => setRoleFilter("")}>ทั้งหมด <span>{users.length}</span></button>{roles.map((role) => { const count = users.filter((user) => user.roles.includes(role.value)).length; return <button type="button" role="tab" aria-selected={roleFilter === role.value} className={roleFilter === role.value ? "active" : ""} key={role.value} onClick={() => setRoleFilter(role.value)}>{role.label} <span>{count}</span></button>; })}<button type="button" role="tab" aria-selected={roleFilter === "IDENTITY_ACCESS"} className={`identity-tab ${roleFilter === "IDENTITY_ACCESS" ? "active" : ""}`} onClick={() => setRoleFilter("IDENTITY_ACCESS")}><FontAwesomeIcon icon={faEye} /> ดูตัวตนนักเรียน <span>{identityAccessCount}</span></button></div>
      <div className="advisor-filter-bar user-search-only"><label className="advisor-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ Username หรือครูที่เชื่อม" /></label></div>
      <div className="user-list">{visible.length === 0 ? <div className="empty-state"><FontAwesomeIcon icon={faUsersGear} /><h3>ยังไม่มีผู้ใช้งานในแท็บนี้</h3><p>เพิ่มบทบาทหรือสิทธิ์จากปุ่มเพิ่มผู้ใช้งาน</p></div> : visible.map((user) => { const protectedAccount = user.username === "cboonta"; const canViewIdentity = protectedAccount || Boolean(user.can_view_student_identity); const advisorLabel = linkedAdvisorLabel(user); const tabRole = roles.find((role) => role.value === roleFilter); return <article key={user.id} className={!user.is_active ? "inactive" : ""}><span className="user-avatar">{user.display_name.slice(0, 1)}</span><div className="user-identity"><b>{user.display_name}</b><small>@{user.username}</small>{protectedAccount && <span className="protected-account"><FontAwesomeIcon icon={faLock} /> ผู้ดูแลสูงสุด</span>}{advisorLabel && <span className="linked-person"><FontAwesomeIcon icon={faLink} /> {advisorLabel}</span>}</div><div className="user-role"><div className="user-role-tags">{user.roles.map((value) => <span key={value}>{roles.find((role) => role.value === value)?.label ?? value}</span>)}{canViewIdentity && <span className="identity-access-tag"><FontAwesomeIcon icon={faEye} /> ดูตัวตนผู้แจ้งได้</span>}</div><small>{protectedAccount ? "เข้าถึงทุกส่วนและไม่สามารถลดสิทธิ์ได้" : `${user.roles.length} บทบาทในบัญชีเดียว`}</small></div><div className="user-actions"><button className="edit-user" onClick={() => editUser(user)} disabled={protectedAccount} title={protectedAccount ? "บัญชีผู้ดูแลสูงสุดถูกป้องกัน" : "แก้ไขข้อมูลและสิทธิ์"} aria-label={`แก้ไข ${user.display_name}`}><FontAwesomeIcon icon={protectedAccount ? faLock : faPen} /><span>{protectedAccount ? "บัญชีหลัก" : "แก้ไข"}</span></button>{!protectedAccount && tabRole && <button type="button" className="remove-role" onClick={() => setRemovingRole({ user, role: tabRole.value })} title={`นำบทบาท ${tabRole.label} ออก`} aria-label={`นำบทบาท ${tabRole.label} ออกจาก ${user.display_name}`}><FontAwesomeIcon icon={faUserMinus} /></button>}<button type="button" role="switch" aria-checked={Boolean(user.is_active)} aria-label={`${user.is_active ? "ปิด" : "เปิด"}ใช้งานบัญชี ${user.display_name}`} className={`account-toggle ${user.is_active ? "on" : "off"}`} onClick={() => toggle(user)} disabled={protectedAccount} title={protectedAccount ? "บัญชีผู้ดูแลสูงสุดเปิดใช้งานถาวร" : user.is_active ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}><span className="toggle-track"><span /></span></button></div></article>; })}</div>
    </section>
    {open && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}><section className="student-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"><form onSubmit={save}>
      <header className="student-modal-header"><div><span className="student-modal-icon"><FontAwesomeIcon icon={editing ? faPen : faPlus} /></span><div><small><FontAwesomeIcon icon={faKey} /> บัญชีและสิทธิ์</small><h2 id="user-modal-title">{editing ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h2></div></div><button type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="ปิด Modal"><FontAwesomeIcon icon={faXmark} /></button></header>
      <div className="student-modal-body user-modal-body"><p className="student-modal-help">เลือกได้มากกว่า 1 บทบาท โดยผู้ใช้เข้าสู่ระบบด้วยบัญชีเดียว</p><div className="user-form-grid">
        <label><span>ชื่อที่แสดง</span><input autoFocus value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="ชื่อบุคลากรหรือชื่องาน" required /></label>
        <label><span>Username</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="ชื่อสำหรับเข้าสู่ระบบ" disabled={Boolean(editing)} required /></label>
        <label><span>{editing ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่าน"}</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? "เว้นว่างหากไม่เปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"} minLength={8} required={!editing} /></label>
        <fieldset className="role-picker"><legend>กำหนดบทบาท <small>เลือกได้หลายรายการ</small></legend><div>{roles.map((role) => { const selected = form.roles.includes(role.value); return <button type="button" key={role.value} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleRole(role.value)}><span><FontAwesomeIcon icon={role.value === "SUPER_ADMIN" ? faShieldHalved : ["DIRECTOR", "DEPUTY_DIRECTOR"].includes(role.value) ? faUserTie : role.value === "ADVISOR" ? faLink : ["LEVEL_HEAD", "TEACHER", "STUDENT_AFFAIRS"].includes(role.value) ? faUserCheck : faKey} /></span><div><b>{role.label}</b><small>{role.detail}</small></div>{selected && <FontAwesomeIcon className="role-selected-check" icon={faCircleCheck} />}</button>; })}</div></fieldset>
        <div className={`identity-permission-card ${form.canViewStudentIdentity ? "enabled" : ""}`}><span className="identity-permission-icon"><FontAwesomeIcon icon={form.canViewStudentIdentity ? faEye : faEyeSlash} /></span><div><b>อนุญาตให้ดูตัวตนนักเรียน</b><small>เห็นชื่อและเลขประจำตัวในเคสที่นักเรียนเลือกปกปิดตัวตน ควรให้เฉพาะผู้ที่จำเป็น</small></div><button type="button" role="switch" aria-checked={form.canViewStudentIdentity} className={`account-toggle ${form.canViewStudentIdentity ? "on" : "off"}`} onClick={() => setForm({ ...form, canViewStudentIdentity: !form.canViewStudentIdentity })} title={form.canViewStudentIdentity ? "กดเพื่อยกเลิกสิทธิ์ดูตัวตน" : "กดเพื่ออนุญาตให้ดูตัวตน"}><span className="toggle-track"><span /></span></button></div>
        {form.roles.includes("ADVISOR") && <label className="advisor-account-link"><span>เชื่อมกับข้อมูลครูที่ปรึกษา</span><select value={form.advisorId} onChange={(event) => { const advisor = advisors.find((item) => item.id === event.target.value); setForm({ ...form, advisorId: event.target.value, ...(!editing && advisor ? { displayName: `${advisor.prefix}${advisor.first_name} ${advisor.last_name}`, username: form.username || advisor.source_username || "" } : {}) }); }} required><option value="">เลือกครูที่ยังไม่มีบัญชี</option>{selectableAdvisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.prefix}{advisor.first_name} {advisor.last_name}{advisor.account_username ? ` · @${advisor.account_username}` : ""}</option>)}</select><small className="field-help">เชื่อมครูหนึ่งครั้ง แล้วเพิ่มบทบาทอื่นในบัญชีเดียวกันได้</small></label>}
        {editing && roleNames(editing.roles) !== roleNames(form.roles) && <div className="role-change-notice"><FontAwesomeIcon icon={faCircleExclamation} /><span><b>กำลังปรับบทบาทของบัญชี</b><small>{roleNames(editing.roles)} → {roleNames(form.roles)}</small></span></div>}
        {form.roles.includes("SUPER_ADMIN") && <div className="role-warning"><FontAwesomeIcon icon={faShieldHalved} /><span><b>สิทธิ์ระดับสูงสุด</b><small>บทบาทนี้ครอบคลุมทุกส่วน รวมถึงจัดการผู้ใช้ ลบเคส และเปลี่ยนสิทธิ์</small></span></div>}
      </div></div>
      <footer className="student-modal-actions">{editing && editing.username !== "cboonta" && <button type="button" className="button delete-account-button" onClick={() => { setOpen(false); setDeleting(editing); }} disabled={saving}><FontAwesomeIcon icon={faTrashCan} /> ลบบัญชีผู้ใช้งานทั้งหมด</button>}<button type="button" className="button secondary" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? "กำลังบันทึก..." : "บันทึกผู้ใช้งาน"}</button></footer>
    </form></section></div>}
    {removingRole && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !roleBusy) setRemovingRole(null); }}><section className="student-modal delete-user-modal" role="dialog" aria-modal="true" aria-labelledby="remove-role-title"><header className="student-modal-header"><div><span className="student-modal-icon"><FontAwesomeIcon icon={faUserMinus} /></span><div><small>จัดการบทบาท</small><h2 id="remove-role-title">นำบทบาทออกจากบัญชี</h2></div></div><button type="button" onClick={() => setRemovingRole(null)} disabled={roleBusy} aria-label="ปิด Modal"><FontAwesomeIcon icon={faXmark} /></button></header><div className="delete-user-body role-removal-body"><p>ต้องการนำบทบาท <b>{roles.find((role) => role.value === removingRole.role)?.label ?? removingRole.role}</b> ออกจากบัญชี <b>{removingRole.user.display_name}</b> ใช่หรือไม่</p><div><FontAwesomeIcon icon={faCircleExclamation} /><span><b>บัญชียังคงอยู่ในระบบ</b><small>ระบบจะยกเลิกเฉพาะสิทธิ์ของบทบาทนี้ บทบาทอื่นและประวัติการทำงานยังอยู่ครบ</small></span></div></div><footer className="student-modal-actions"><button type="button" className="button secondary" onClick={() => setRemovingRole(null)} disabled={roleBusy}>ยกเลิก</button><button type="button" className="button danger" onClick={removeSelectedRole} disabled={roleBusy}><FontAwesomeIcon icon={faUserMinus} /> {roleBusy ? "กำลังนำออก..." : "ยืนยันนำบทบาทออก"}</button></footer></section></div>}
    {deleting && <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setDeleting(null); }}><section className="student-modal delete-user-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><header className="student-modal-header"><div><span className="student-modal-icon danger"><FontAwesomeIcon icon={faTriangleExclamation} /></span><div><small>ตรวจสอบก่อนลบ</small><h2 id="delete-user-title">ลบบัญชีผู้ใช้งาน</h2></div></div><button type="button" onClick={() => setDeleting(null)} disabled={deleteBusy} aria-label="ปิด Modal"><FontAwesomeIcon icon={faXmark} /></button></header><div className="delete-user-body"><p>ต้องการลบบัญชี <b>{deleting.display_name}</b> (@{deleting.username}) ใช่หรือไม่</p><div><FontAwesomeIcon icon={faCircleExclamation} /><span><b>การลบไม่สามารถย้อนกลับได้</b><small>หากบัญชีนี้มีประวัติเกี่ยวข้องกับเคส ระบบจะไม่ลบและจะแนะนำให้ปิดใช้งานแทน</small></span></div></div><footer className="student-modal-actions"><button type="button" className="button secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>ยกเลิก</button><button type="button" className="button danger" onClick={deleteUser} disabled={deleteBusy}><FontAwesomeIcon icon={faTrashCan} /> {deleteBusy ? "กำลังลบ..." : "ยืนยันลบบัญชี"}</button></footer></section></div>}
    {toast && <div className={`admin-toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"}><FontAwesomeIcon icon={toast.type === "error" ? faCircleExclamation : faCircleCheck} /><span>{toast.text}</span><button type="button" onClick={() => setToast(null)} aria-label="ปิดการแจ้งเตือน"><FontAwesomeIcon icon={faXmark} /></button></div>}
  </main>;
}
