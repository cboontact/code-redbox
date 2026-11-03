import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  studentCardNumber: text("student_card_number"),
  trackingPasswordHash: text("tracking_password_hash"),
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

export const advisors = sqliteTable("advisors", {
  id: text("id").primaryKey(),
  prefix: text("prefix").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  sourceUsername: text("source_username"),
  specialRole: text("special_role"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const advisorAssignments = sqliteTable("advisor_assignments", {
  id: text("id").primaryKey(),
  advisorId: text("advisor_id").notNull().references(() => advisors.id),
  level: text("level").notNull(),
  classroom: text("classroom").notNull(),
  slot: integer("slot").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("advisor_assignment_room_slot_unique").on(table.level, table.classroom, table.slot),
  uniqueIndex("advisor_assignment_advisor_room_unique").on(table.advisorId, table.level, table.classroom),
]);

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
  trackingPasswordHash: text("tracking_password_hash"),
  uploadTokenHash: text("upload_token_hash"),
  uploadTokenExpiresAt: text("upload_token_expires_at"),
  severity: text("severity").notNull().default("WATCH"),
  status: text("status").notNull().default("NEW"),
  assignedTo: text("assigned_to"),
  exclusiveReviewerUsername: text("exclusive_reviewer_username"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const caseSequences = sqliteTable("case_sequences", {
  year: text("year").primaryKey(),
  lastValue: integer("last_value").notNull(),
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
  isEditable: integer("is_editable", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const staffUsers = sqliteTable("staff_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  advisorId: text("advisor_id"),
  canViewStudentIdentity: integer("can_view_student_identity", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const staffUserRoles = sqliteTable("staff_user_roles", {
  userId: text("user_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.role] }),
  index("idx_staff_user_roles_role").on(table.role, table.userId),
]);

export const caseHandoffs = sqliteTable("case_handoffs", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  fromUsername: text("from_username").notNull(),
  toUsername: text("to_username"),
  reason: text("reason").notNull(),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const caseAssignments = sqliteTable("case_assignments", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => staffUsers.id),
  username: text("username").notNull(),
  assignmentRole: text("assignment_role").notNull().default("MEMBER"),
  status: text("status").notNull().default("ASSIGNED"),
  assignedBy: text("assigned_by").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("case_assignments_case_user_unique").on(table.caseId, table.userId),
  index("idx_case_assignments_user_status").on(table.username, table.status),
]);

export const directorActions = sqliteTable("director_actions", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  directorId: text("director_id").notNull(),
  action: text("action").notNull(),
  message: text("message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attachments = sqliteTable("case_attachments", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
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
