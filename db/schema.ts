import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  prefix: text("prefix").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  level: text("level").notNull(),
  classroom: text("classroom").notNull(),
  number: integer("number").notNull(),
  advisor1: text("advisor1").notNull(),
  advisor2: text("advisor2"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const categories = sqliteTable("case_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  studentId: text("student_id").notNull().references(() => students.id),
  categoryId: text("category_id").notNull().references(() => categories.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  peopleInvolved: text("people_involved"),
  requestedHelp: text("requested_help").notNull(),
  safetyLevel: text("safety_level").notNull(),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  requiresImmediateReview: integer("requires_immediate_review", { mode: "boolean" }).notNull().default(false),
  severity: text("severity").notNull().default("GENERAL"),
  status: text("status").notNull().default("NEW"),
  assignedTo: text("assigned_to"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const timeline = sqliteTable("case_timeline", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  action: text("action").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notes = sqliteTable("case_notes", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  note: text("note").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  actor: text("actor").notNull(),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
