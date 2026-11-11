declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    EVIDENCE: R2Bucket;
    SESSION_SECRET: string;
    STUDENT_IDENTITY_PEPPER?: string;
  }
}
