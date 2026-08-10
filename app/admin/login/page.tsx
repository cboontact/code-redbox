import Image from "next/image";
import Link from "next/link";
import { chatGPTSignInPath } from "../../chatgpt-auth";

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <Image src="/images/chomthong-logo.png" width={92} height={92} alt="ตราโรงเรียนจอมทอง" priority />
        <span className="eyebrow">สำหรับเจ้าหน้าที่</span>
        <h1>เข้าสู่ระบบกล่องแดง</h1>
        <p>ใช้บัญชีที่ได้รับอนุญาตจากโรงเรียนเพื่อดูแลและติดตามเคสของนักเรียน</p>
        <Link className="button primary wide" href={chatGPTSignInPath("/admin")}>
          เข้าสู่ระบบด้วยบัญชีโรงเรียน
        </Link>
        <Link className="text-link" href="/">กลับหน้าแรก</Link>
        <small>ข้อมูลทุกการเข้าถึงจะถูกบันทึกเพื่อความปลอดภัย</small>
      </section>
    </main>
  );
}
