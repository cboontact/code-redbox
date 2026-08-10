"use client";

import { FormEvent, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightToBracket, faCircleInfo, faLock, faUser } from "@fortawesome/free-solid-svg-icons";

export function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถเข้าสู่ระบบได้");
      window.location.href = "/admin";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถเข้าสู่ระบบได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={login}>
      <label><span>ชื่อผู้ใช้</span><div><FontAwesomeIcon icon={faUser} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label>
      <label><span>รหัสผ่าน</span><div><FontAwesomeIcon icon={faLock} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>
      {error && <p className="login-error" role="alert"><FontAwesomeIcon icon={faCircleInfo} /> {error}</p>}
      <button className="button primary wide" disabled={loading}>
        {loading ? <><span className="spinner" /> กำลังเข้าสู่ระบบ...</> : <><FontAwesomeIcon icon={faArrowRightToBracket} /> เข้าสู่ระบบ</>}
      </button>
    </form>
  );
}
