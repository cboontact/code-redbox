/* eslint-disable @next/next/no-img-element -- Local static school logo does not require an image optimization service. */
import Link from "next/link";
import { AdminLoginForm } from "../../../components/AdminLoginForm";

export default function DirectorLoginPage() {
  return <main className="login-page"><section className="login-card"><img className="school-logo" src="/images/chomthong-logo.png" width={92} height={92} alt="ตราโรงเรียนจอมทอง" /><span className="eyebrow">สำหรับผู้อำนวยการ</span><h1>Director Sign in</h1><p>เข้าสู่หน้าพิจารณาเคสที่เจ้าหน้าที่เสนอมา</p><AdminLoginForm role="DIRECTOR" /><Link className="text-link" href="/admin/login">เข้าสู่ระบบเจ้าหน้าที่</Link><Link className="text-link" href="/">กลับหน้าแรก</Link></section></main>;
}
