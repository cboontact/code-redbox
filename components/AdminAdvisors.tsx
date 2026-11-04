"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faEnvelope,
  faFloppyDisk,
  faKey,
  faLink,
  faMagnifyingGlass,
  faPen,
  faPhone,
  faPlus,
  faRotate,
  faSchool,
  faUserSlash,
  faUserTie,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

type Advisor = { id: string; prefix: string; first_name: string; last_name: string; email: string; phone: string; source_username?: string | null; special_role?: string | null; account_user_id?: string | null; account_username?: string | null; account_is_active?: number | null };
type Assignment = { id: string; advisor_id: string; level: string; classroom: string; slot: number; student_count: number; advisor_name: string };
type Room = { level: string; classroom: string; student_count: number };
type FormAssignment = { level: string; classroom: string };
const prefixOptions = ["นาย", "นาง", "นางสาว", "ว่าที่ร้อยตรี"] as const;
const customPrefixValue = "__OTHER__";
const emptyForm = { id: "", prefix: "นาย", firstName: "", lastName: "", email: "", phone: "", assignments: [] as FormAssignment[] };

export function AdminAdvisors() {
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const roomAdvisorCounts = useMemo(
    () => assignments.reduce((counts, item) => {
      const key = `${item.level}|${item.classroom}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    [assignments],
  );
  const usesCustomPrefix = !prefixOptions.some((prefix) => prefix === form.prefix);
  const canAddRoom = rooms.some((room) => !form.assignments.some((item) => item.level === room.level && item.classroom === room.classroom));
  const levels = useMemo(() => [...new Set(rooms.map((room) => room.level))], [rooms]);
  const filterRooms = useMemo(() => rooms.filter((room) => !levelFilter || room.level === levelFilter), [rooms, levelFilter]);
  const filteredAdvisors = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("th");
    return advisors.filter((advisor) => {
      const own = assignments.filter((item) => item.advisor_id === advisor.id);
      const searchable = [advisor.prefix, advisor.first_name, advisor.last_name, advisor.email, advisor.phone, advisor.source_username, advisor.special_role, advisor.account_username, ...own.map((item) => `${item.level}/${item.classroom}`)].join(" ").toLocaleLowerCase("th");
      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesLevel = !levelFilter || own.some((item) => item.level === levelFilter);
      const matchesRoom = !roomFilter || own.some((item) => `${item.level}|${item.classroom}` === roomFilter);
      const matchesAssignment = assignmentFilter === "all" || (assignmentFilter === "assigned" ? own.length > 0 : own.length === 0);
      return matchesSearch && matchesLevel && matchesRoom && matchesAssignment;
    });
  }, [advisors, assignments, assignmentFilter, levelFilter, roomFilter, search]);
  const hasFilters = Boolean(search || levelFilter || roomFilter || assignmentFilter !== "all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/advisors");
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json() as { advisors?: Advisor[]; assignments?: Assignment[]; rooms?: Room[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setAdvisors(data.advisors ?? []);
      setAssignments(data.assignments ?? []);
      setRooms(data.rooms ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function edit(advisor: Advisor) {
    setForm({
      id: advisor.id,
      prefix: advisor.prefix,
      firstName: advisor.first_name,
      lastName: advisor.last_name,
      email: advisor.email ?? "",
      phone: advisor.phone ?? "",
      assignments: assignments
        .filter((item) => item.advisor_id === advisor.id)
        .map(({ level, classroom }) => ({ level, classroom })),
    });
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startAdd() {
    setForm(emptyForm);
    setError("");
    setActiveTab("form");
  }

  function addRoom() {
    const room = rooms.find((candidate) => !form.assignments.some((item) => item.level === candidate.level && item.classroom === candidate.classroom));
    if (!room) return;
    setForm({
      ...form,
      assignments: [...form.assignments, { level: room.level, classroom: room.classroom }],
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const endpoint = form.id ? `/api/advisors/${form.id}` : "/api/advisors";
      const response = await fetch(endpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setForm(emptyForm);
      await load();
      setActiveTab("list");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(advisor: Advisor) {
    if (!window.confirm(`ปิดใช้งาน ${advisor.prefix}${advisor.first_name} ${advisor.last_name} ใช่หรือไม่`)) return;
    const response = await fetch(`/api/advisors/${advisor.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json() as { error?: string };
      setError(data.error ?? "ดำเนินการไม่สำเร็จ");
      return;
    }
    if (form.id === advisor.id) setForm(emptyForm);
    await load();
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="management-page advisor-management-page">
      <header className="management-header">
        <div>
          <span className="eyebrow"><FontAwesomeIcon icon={faUserTie} /> จัดการข้อมูล</span>
          <h1>ครูที่ปรึกษา</h1>
          <p>กำหนดครูประจำห้อง แล้วระบบจะเชื่อมกับนักเรียนในห้องนั้นโดยอัตโนมัติ</p>
        </div>
        <button className="button secondary compact" onClick={load} disabled={loading}><FontAwesomeIcon icon={faRotate} /> รีเฟรช</button>
      </header>

      {error && <div className="management-error"><FontAwesomeIcon icon={faCircleInfo} /> {error}</div>}

      <div className="advisor-tabs" role="tablist" aria-label="เมนูจัดการครูที่ปรึกษา">
        <button type="button" role="tab" aria-selected={activeTab === "list"} className={activeTab === "list" ? "active" : ""} onClick={() => setActiveTab("list")}><FontAwesomeIcon icon={faUserTie} /><span>ครูที่ปรึกษาทั้งหมด</span><b>{advisors.length}</b></button>
        <button type="button" role="tab" aria-selected={activeTab === "form"} className={activeTab === "form" ? "active" : ""} onClick={startAdd}><FontAwesomeIcon icon={faPlus} /><span>เพิ่มครูที่ปรึกษา</span></button>
      </div>

      <div className="advisor-tab-content">
        {activeTab === "form" ? <form className="advisor-form management-card" onSubmit={save}>
          <div className="panel-heading">
            <h2>{form.id ? "แก้ไขครูที่ปรึกษา" : "เพิ่มครูที่ปรึกษา"}</h2>
            <p>ครูหนึ่งคนดูแลได้หลายห้อง และแต่ละห้องมีครูที่ปรึกษาได้หลายคน</p>
          </div>

          <div className="advisor-form-grid">
            <label className="advisor-field-prefix">
              <span>คำนำหน้า</span>
              <div className="advisor-prefix-controls">
                <select
                  value={usesCustomPrefix ? customPrefixValue : form.prefix}
                  onChange={(event) => setForm({
                    ...form,
                    prefix: event.target.value === customPrefixValue ? "" : event.target.value,
                  })}
                  aria-label="เลือกคำนำหน้าครูที่ปรึกษา"
                >
                  {prefixOptions.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
                  <option value={customPrefixValue}>อื่น ๆ (ระบุ)</option>
                </select>
                {usesCustomPrefix && (
                  <input
                    value={form.prefix}
                    onChange={(event) => setForm({ ...form, prefix: event.target.value })}
                    placeholder="ระบุคำนำหน้า"
                    aria-label="ระบุคำนำหน้าอื่น ๆ"
                    maxLength={30}
                    required
                  />
                )}
              </div>
            </label>
            <label><span>ชื่อ</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label>
            <label><span>นามสกุล</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label>
            <label className="advisor-field-contact"><span>อีเมล</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="example@school.ac.th" /></label>
            <label className="advisor-field-contact"><span>โทรศัพท์</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="เช่น 08x-xxx-xxxx" /></label>
          </div>

          <div className="assignment-editor">
            <div><div><h3>ห้องที่รับผิดชอบ</h3><p>เลือกได้หลายห้อง ระบบจัดลำดับครูของแต่ละห้องให้อัตโนมัติ</p></div><button type="button" onClick={addRoom} disabled={!canAddRoom}><FontAwesomeIcon icon={faPlus} /> เพิ่มห้อง</button></div>
            {form.assignments.length === 0 ? (
              <div className="assignment-empty"><FontAwesomeIcon icon={faSchool} /><span>ยังไม่ได้กำหนดห้อง</span></div>
            ) : form.assignments.map((item, index) => {
              const roomKey = `${item.level}|${item.classroom}`;
              const advisorCount = roomAdvisorCounts.get(roomKey) ?? 0;
              return (
                <div className="assignment-row" key={`${roomKey}-${index}`}>
                  <select value={roomKey} aria-label={`ห้องที่รับผิดชอบรายการ ${index + 1}`} onChange={(event) => {
                    const [level, classroom] = event.target.value.split("|");
                    const next = [...form.assignments];
                    next[index] = { ...next[index], level, classroom };
                    setForm({ ...form, assignments: next });
                  }}>
                    {rooms.map((room) => {
                      const isSelectedElsewhere = form.assignments.some((selected, selectedIndex) => selectedIndex !== index && selected.level === room.level && selected.classroom === room.classroom);
                      return <option key={`${room.level}|${room.classroom}`} value={`${room.level}|${room.classroom}`} disabled={isSelectedElsewhere}>{room.level}/{room.classroom} · นักเรียน {room.student_count} คน</option>;
                    })}
                  </select>
                  <button type="button" aria-label="นำห้องออก" title="นำห้องออก" onClick={() => setForm({ ...form, assignments: form.assignments.filter((_, itemIndex) => itemIndex !== index) })}><FontAwesomeIcon icon={faXmark} /></button>
                  <small>{advisorCount > 0 ? `ปัจจุบันห้องนี้มีครูที่ปรึกษา ${advisorCount} คน` : "ห้องนี้ยังไม่มีครูที่ปรึกษา"}</small>
                </div>
              );
            })}
          </div>

          <div className="advisor-form-actions">
            <button type="button" className="button secondary" onClick={() => { setForm(emptyForm); setActiveTab("list"); }}>ยกเลิก</button>
            <button className="button primary" disabled={saving}><FontAwesomeIcon icon={faFloppyDisk} /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
          </div>
        </form> : (

        <section className="management-card advisor-list">
          <div className="panel-heading advisor-list-heading"><div><h2>ครูที่ปรึกษาทั้งหมด</h2><p>ค้นหา กรองตามห้อง และตรวจสอบข้อมูลติดต่อ</p></div><strong>{filteredAdvisors.length} จาก {advisors.length} คน</strong></div>
          <div className="advisor-filter-bar">
            <label className="advisor-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ อีเมล โทรศัพท์ หรือห้อง..." aria-label="ค้นหาครูที่ปรึกษา" /></label>
            <select value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value); setRoomFilter(""); }} aria-label="กรองตามระดับชั้น"><option value="">ทุกระดับชั้น</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select>
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} aria-label="กรองตามห้อง"><option value="">ทุกห้อง</option>{filterRooms.map((room) => <option key={`${room.level}|${room.classroom}`} value={`${room.level}|${room.classroom}`}>{room.level}/{room.classroom}</option>)}</select>
            <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} aria-label="กรองตามการกำหนดห้อง"><option value="all">ทั้งหมด</option><option value="assigned">กำหนดห้องแล้ว</option><option value="unassigned">ยังไม่ได้กำหนดห้อง</option></select>
            {hasFilters && <button type="button" className="clear-filter" onClick={() => { setSearch(""); setLevelFilter(""); setRoomFilter(""); setAssignmentFilter("all"); }}><FontAwesomeIcon icon={faXmark} /> ล้างตัวกรอง</button>}
          </div>
          {loading ? (
            <div className="table-skeleton"><span /><span /><span /></div>
          ) : filteredAdvisors.length === 0 ? (
            <div className="empty-state"><h3>{advisors.length === 0 ? "ยังไม่มีข้อมูลครู" : "ไม่พบครูที่ตรงกับตัวกรอง"}</h3><p>{advisors.length === 0 ? "เพิ่มครูที่ปรึกษาจากแท็บเพิ่มครูที่ปรึกษา" : "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"}</p></div>
          ) : filteredAdvisors.map((advisor) => {
            const own = assignments.filter((item) => item.advisor_id === advisor.id);
            return (
              <article className="advisor-item" key={advisor.id}>
                <span className="advisor-avatar">{advisor.first_name.slice(0, 1)}</span>
                <div className="advisor-item-body">
                  <div className="advisor-primary-line">
                    <h3>{advisor.prefix}{advisor.first_name} {advisor.last_name}</h3>
                    {advisor.special_role && <span className="advisor-special-role">{advisor.special_role}</span>}
                    <div className="advisor-room-list">
                      {own.length ? own.map((item) => <span key={item.id}>{item.level}/{item.classroom} · {item.student_count} คน</span>) : <span className="empty">ยังไม่ได้กำหนดห้อง</span>}
                    </div>
                  </div>
                  <div className="advisor-contact-list">
                    {advisor.email && <span><FontAwesomeIcon icon={faEnvelope} /> {advisor.email}</span>}
                    {advisor.phone && <span><FontAwesomeIcon icon={faPhone} /> {advisor.phone}</span>}
                    {!advisor.email && !advisor.phone && <span>ไม่มีข้อมูลติดต่อ</span>}
                    <span className={`advisor-account-status ${advisor.account_user_id ? "linked" : ""} ${advisor.account_user_id && !advisor.account_is_active ? "inactive" : ""}`}><FontAwesomeIcon icon={advisor.account_user_id ? faLink : faKey} /> {advisor.account_user_id ? `บัญชี @${advisor.account_username}${advisor.account_is_active ? "" : " · ปิดใช้งาน"}` : "ยังไม่มีบัญชีเข้าสู่ระบบ"}</span>
                  </div>
                </div>
                <div className="advisor-item-actions">
                  <button type="button" className="account" onClick={() => { window.location.href = advisor.account_user_id ? "/admin/users" : `/admin/users?advisorId=${advisor.id}`; }} aria-label={`${advisor.account_user_id ? "ดูบัญชี" : "สร้างบัญชีให้"} ${advisor.first_name}`} title={advisor.account_user_id ? `บัญชี @${advisor.account_username}` : "สร้างบัญชีเข้าสู่ระบบ"}><FontAwesomeIcon icon={faKey} /></button>
                  <button type="button" onClick={() => edit(advisor)} aria-label={`แก้ไข ${advisor.first_name}`} title="แก้ไขข้อมูล"><FontAwesomeIcon icon={faPen} /></button>
                  <button type="button" className="danger" onClick={() => deactivate(advisor)} aria-label={`ปิดใช้งาน ${advisor.first_name}`} title="ปิดใช้งาน"><FontAwesomeIcon icon={faUserSlash} /></button>
                </div>
              </article>
            );
          })}
        </section>
        )}
      </div>
    </main>
  );
}
