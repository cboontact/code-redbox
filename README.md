# กล่องแดง | RED BOX

ระบบรับแจ้งปัญหา ขอความช่วยเหลือ และติดตามเคสของนักเรียน โรงเรียนจอมทอง

## ความสามารถในรุ่นแรก

- Landing Page สำหรับนักเรียน
- ยืนยันตัวตนด้วยเลขประจำตัวนักเรียน
- แบบแจ้งเรื่อง 6 ขั้น พร้อมตัวเลือกปกปิดตัวตนและ Safety Check
- แนบหลักฐานแบบ Private บน Cloudflare R2
- สร้างหมายเลขเคสและติดตามสถานะ
- Dashboard เจ้าหน้าที่ พร้อมค้นหาและกรองเคส
- เปลี่ยนสถานะ ความสำคัญ ผู้รับผิดชอบ และเพิ่มบันทึกภายใน
- Timeline และ Audit Log
- Responsive สำหรับโทรศัพท์ แท็บเล็ต และ Desktop

ข้อมูลตัวอย่างสำหรับ Local Preview: เลขประจำตัว `12345` และ `23456`

## Development

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## ตรวจสอบ Production Build

```bash
npm run build
npm test
```

## Cloudflare

ระบบใช้ Binding ต่อไปนี้:

- `DB`: Cloudflare D1
- `EVIDENCE`: Private Cloudflare R2 bucket

ค่าทั้งสองประกาศไว้ใน `.openai/hosting.json` และจะถูกจัดเตรียมเมื่อ Deploy ผ่าน Sites

หน้าเจ้าหน้าที่บน Production ใช้ระบบ Sign in ของ Hosting และตรวจสิทธิ์ซ้ำที่ API ส่วน Local Preview อนุญาตให้เปิด `/admin` เพื่อทดสอบการทำงาน

## ข้อควรทำก่อนใช้งานจริง

1. Import รายชื่อนักเรียนจริงแทน seed ตัวอย่าง
2. กำหนดผู้ใช้งานและสิทธิ์เจ้าหน้าที่ของโรงเรียน
3. ตั้ง Retention Policy สำหรับเคสและหลักฐาน
4. เปิด Turnstile/WAF Rate Limit ที่ Cloudflare
5. ทดสอบกระบวนการรับเคส Critical กับผู้รับผิดชอบจริง
