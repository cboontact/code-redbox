import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "กล่องแดง | RED BOX — โรงเรียนจอมทอง",
    description: "พื้นที่ปลอดภัยสำหรับทุกเสียงของนักเรียน โรงเรียนจอมทอง",
    icons: { icon: "/images/chomthong-logo.png" },
    openGraph: { title: "กล่องแดง | RED BOX", description: "พื้นที่ปลอดภัยสำหรับทุกเสียงของนักเรียน", images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title: "กล่องแดง | RED BOX", description: "พื้นที่ปลอดภัยสำหรับทุกเสียงของนักเรียน", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
