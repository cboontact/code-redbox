import Image from "next/image";
import Link from "next/link";
import { AdminLoginForm } from "../../../components/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <Image src="/images/chomthong-logo.png" width={92} height={92} alt="ตราโรงเรียนจอมทอง" priority />
        <span className="eyebrow">สำหรับเจ้าหน้าที่</span>
        <h1>เข้าสู่ระบบกล่องแดง</h1>
        <p>กรอกชื่อผู้ใช้และรหัสผ่านที่ได้รับจากโรงเรียน</p>
        <AdminLoginForm />
        <Link className="text-link" href="/">กลับหน้าแรก</Link>
        <small>ข้อมูลทุกการเข้าถึงจะถูกบันทึกเพื่อความปลอดภัย</small>
      </section>
    </main>
  );
}
