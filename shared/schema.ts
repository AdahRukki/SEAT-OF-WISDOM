import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  text,
  integer,
  decimal,
  boolean,
  uuid,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Schools table (for multiple branches)
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  sortOrder: integer("sort_order").default(1), // Ensures consistent ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Classes table
export const classes = pgTable("classes", {
  id: varchar("id", { length: 50 }).primaryKey(), // Human-readable ID like "SCH1-JSS1"
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Class-Subject mapping table
export const classSubjects = pgTable("class_subjects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table (for admins, sub-admins, and students)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("student"), // admin, sub-admin, student
  schoolId: uuid("school_id").references(() => schools.id), // sub-admins and students are tied to specific schools
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Students table (extends users with student-specific info)
export const students = pgTable("students", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(), // e.g., "STU001"
  dateOfBirth: timestamp("date_of_birth"),
  parentContact: varchar("parent_contact", { length: 255 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assessments table (First CA, Second CA, Exam)
export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(), // "First Term", "Second Term", "Third Term"
  session: varchar("session", { length: 20 }).notNull(), // "2024/2025"
  firstCA: integer("first_ca").default(0),
  secondCA: integer("second_ca").default(0),
  exam: integer("exam").default(0),
  total: integer("total").default(0),
  grade: varchar("grade", { length: 2 }),
  remark: text("remark"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Report card templates
export const reportCardTemplates = pgTable("report_card_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  schoolName: varchar("school_name", { length: 255 }),
  schoolLogo: text("school_logo"),
  schoolAddress: text("school_address"),
  headerConfig: jsonb("header_config"),
  gradesConfig: jsonb("grades_config"),
  footerConfig: jsonb("footer_config"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee Types table (different types of fees like tuition, books, etc.)
export const feeTypes = pgTable("fee_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student Fees table (records fees assigned to students)
export const studentFees = pgTable("student_fees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  feeTypeId: uuid("fee_type_id").notNull().references(() => feeTypes.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(),
  session: varchar("session", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, paid, overdue, waived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table (records when students make payments)
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  studentFeeId: uuid("student_fee_id").notNull().references(() => studentFees.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // cash, bank_transfer, cheque, card
  reference: varchar("reference", { length: 100 }), // receipt number or transaction reference
  paymentDate: timestamp("payment_date").defaultNow(),
  recordedBy: uuid("recorded_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  classes: many(classes),
  users: many(users),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  students: many(students),
  subjects: many(classSubjects),
  assessments: many(assessments),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  classes: many(classSubjects),
  assessments: many(assessments),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  class: one(classes, {
    fields: [classSubjects.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [classSubjects.subjectId],
    references: [subjects.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  student: one(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  student: one(students, {
    fields: [assessments.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [assessments.subjectId],
    references: [subjects.id],
  }),
  class: one(classes, {
    fields: [assessments.classId],
    references: [classes.id],
  }),
}));

export const feeTypesRelations = relations(feeTypes, ({ one, many }) => ({
  school: one(schools, {
    fields: [feeTypes.schoolId],
    references: [schools.id],
  }),
  studentFees: many(studentFees),
}));

export const studentFeesRelations = relations(studentFees, ({ one, many }) => ({
  student: one(students, {
    fields: [studentFees.studentId],
    references: [students.id],
  }),
  feeType: one(feeTypes, {
    fields: [studentFees.feeTypeId],
    references: [feeTypes.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(students, {
    fields: [payments.studentId],
    references: [students.id],
  }),
  studentFee: one(studentFees, {
    fields: [payments.studentFeeId],
    references: [studentFees.id],
  }),
  recordedBy: one(users, {
    fields: [payments.recordedBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssessmentSchema = createInsertSchema(assessments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportCardTemplateSchema = createInsertSchema(reportCardTemplates);

// Additional validation schemas
export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const addScoreSchema = z.object({
  studentId: z.string(),
  subjectId: z.string(),
  classId: z.string(),
  term: z.string(),
  session: z.string(),
  firstCA: z.number().min(0).max(20).optional(),
  secondCA: z.number().min(0).max(20).optional(),
  exam: z.number().min(0).max(60).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

// Financial schemas
export const insertFeeTypeSchema = createInsertSchema(feeTypes).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  amount: z.string().transform((val) => {
    // Remove commas and convert to number
    const numericValue = parseFloat(val.replace(/,/g, ''));
    if (isNaN(numericValue)) {
      throw new Error('Invalid amount');
    }
    return numericValue.toString();
  }),
});
export const insertStudentFeeSchema = createInsertSchema(studentFees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });

export const recordPaymentSchema = z.object({
  studentFeeId: z.string(),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  reference: z.string().optional(),
  paymentDate: z.string(),
  notes: z.string().optional(),
});

// Types
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

export type ReportCardTemplate = typeof reportCardTemplates.$inferSelect;
export type InsertReportCardTemplate = z.infer<typeof insertReportCardTemplateSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type AddScore = z.infer<typeof addScoreSchema>;

// Financial types
export type FeeType = typeof feeTypes.$inferSelect;
export type InsertFeeType = z.infer<typeof insertFeeTypeSchema>;

export type StudentFee = typeof studentFees.$inferSelect;
export type InsertStudentFee = z.infer<typeof insertStudentFeeSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type RecordPayment = z.infer<typeof recordPaymentSchema>;

// Student with relations
export type StudentWithDetails = Student & {
  user: User;
  class: Class;
  assessments: (Assessment & {
    subject: Subject;
  })[];
};

// Student fee with relations
export type StudentFeeWithDetails = StudentFee & {
  feeType: FeeType;
  student: Student & {
    user: User;
  };
  payments: Payment[];
};

// Payment with relations
export type PaymentWithDetails = Payment & {
  studentFee: StudentFee & {
    feeType: FeeType;
  };
  student: Student & {
    user: User;
  };
  recordedBy?: User;
};
