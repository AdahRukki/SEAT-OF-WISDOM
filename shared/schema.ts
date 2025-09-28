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

// Settings table (for global academy configuration)
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Academic sessions and terms
export const academicSessions = pgTable("academic_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionYear: varchar("session_year", { length: 20 }).notNull().unique(), // e.g., "2024/2025"
  isActive: boolean("is_active").default(false),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const academicTerms = pgTable("academic_terms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  termName: varchar("term_name", { length: 20 }).notNull(), // "First Term", "Second Term", "Third Term"
  sessionId: uuid("session_id").notNull().references(() => academicSessions.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(false),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  resumptionDate: timestamp("resumption_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  studentId: varchar("student_id", { length: 50 }).notNull().unique(), // e.g., "SOWA/1001"
  dateOfBirth: timestamp("date_of_birth"),
  age: integer("age"), // Student's age
  gender: varchar("gender", { length: 10 }), // Male, Female, Other
  profileImage: text("profile_image"), // URL or path to profile image
  parentContact: varchar("parent_contact", { length: 255 }),
  parentWhatsapp: varchar("parent_whatsapp", { length: 20 }), // WhatsApp number for parents
  address: text("address"),
  status: varchar("status", { length: 20 }).default("active"), // active, graduated
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

// Attendance table (total attendance scores per student per term/session)
export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(), // "First Term", "Second Term", "Third Term"
  session: varchar("session", { length: 20 }).notNull(), // "2024/2025"
  totalDays: integer("total_days").notNull().default(0), // Total school days in term
  presentDays: integer("present_days").notNull().default(0), // Days student was present
  absentDays: integer("absent_days").notNull().default(0), // Days student was absent
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

// Non-Academic Ratings table (for behavioral assessments)
export const nonAcademicRatings = pgTable("non_academic_ratings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(),
  session: varchar("session", { length: 20 }).notNull(),
  attendancePunctuality: integer("attendance_punctuality").default(3), // 1-5 scale
  neatnessOrganization: integer("neatness_organization").default(3), // 1-5 scale
  respectPoliteness: integer("respect_politeness").default(3), // 1-5 scale
  participationTeamwork: integer("participation_teamwork").default(3), // 1-5 scale
  responsibility: integer("responsibility").default(3), // 1-5 scale
  ratedBy: uuid("rated_by").references(() => users.id), // Teacher who gave the rating
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Academic Calendar Events table
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // term_start, term_end, exam, holiday, etc.
  schoolId: uuid("school_id").references(() => schools.id), // null means all schools
  isSystemWide: boolean("is_system_wide").default(false), // true for events affecting all branches
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated Report Cards table
export const generatedReportCards = pgTable("generated_report_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 50 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 50 }).notNull(),
  session: varchar("session", { length: 20 }).notNull(),
  studentName: varchar("student_name", { length: 200 }).notNull(),
  className: varchar("class_name", { length: 100 }).notNull(),
  totalScore: decimal("total_score", { precision: 5, scale: 2 }),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }),
  attendancePercentage: decimal("attendance_percentage", { precision: 5, scale: 2 }),
  attendanceDays: varchar("attendance_days", { length: 20 }), // e.g., "85 out of 90 days"
  nextTermResume: timestamp("next_term_resume"), // Next term resumption date
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow(),
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
  attendance: many(attendance),
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

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [attendance.classId],
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

export const nonAcademicRatingsRelations = relations(nonAcademicRatings, ({ one }) => ({
  student: one(students, {
    fields: [nonAcademicRatings.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [nonAcademicRatings.classId],
    references: [classes.id],
  }),
  ratedBy: one(users, {
    fields: [nonAcademicRatings.ratedBy],
    references: [users.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  school: one(schools, {
    fields: [calendarEvents.schoolId],
    references: [schools.id],
  }),
  createdBy: one(users, {
    fields: [calendarEvents.createdBy],
    references: [users.id],
  }),
}));

export const generatedReportCardsRelations = relations(generatedReportCards, ({ one }) => ({
  student: one(students, {
    fields: [generatedReportCards.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [generatedReportCards.classId],
    references: [classes.id],
  }),
  generatedBy: one(users, {
    fields: [generatedReportCards.generatedBy],
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
export const insertGeneratedReportCardSchema = createInsertSchema(generatedReportCards).omit({ id: true, generatedAt: true });

// Additional validation schemas
export const loginSchema = z.object({
  email: z.string().min(1, "Email or Student ID is required").refine((val) => {
    // Accept either email format or SOWA/#### student ID format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const studentIdRegex = /^SOWA\/\d{4}$/;
    return emailRegex.test(val) || studentIdRegex.test(val);
  }, {
    message: "Please enter a valid email address or student ID (e.g., SOWA/1001)",
  }),
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

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true, updatedAt: true });

export const addAttendanceSchema = z.object({
  studentId: z.string(),
  classId: z.string(),
  term: z.string(),
  session: z.string(),
  totalDays: z.number().min(0, "Total days must be positive"),
  presentDays: z.number().min(0, "Present days must be positive"),
  absentDays: z.number().min(0, "Absent days must be positive"),
}).refine((data) => data.presentDays + data.absentDays === data.totalDays, {
  message: "Present days + Absent days must equal Total days",
  path: ["totalDays"],
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
  paymentMethod: z.string().optional().default("cash"),
  reference: z.string().optional(),
  paymentDate: z.string(),
  notes: z.string().optional(),
});

export const assignFeeSchema = z.object({
  feeTypeId: z.string().min(1, "Fee type is required"),
  classId: z.string().min(1, "Class is required"),
  term: z.string().min(1, "Term is required"),
  session: z.string().min(1, "Session is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

// Non-academic rating validation
export const insertNonAcademicRatingSchema = createInsertSchema(nonAcademicRatings).omit({ id: true, createdAt: true, updatedAt: true });
export const updateNonAcademicRatingSchema = z.object({
  studentId: z.string(),
  classId: z.string(),
  term: z.string(),
  session: z.string(),
  attendancePunctuality: z.number().min(1).max(5),
  neatnessOrganization: z.number().min(1).max(5),
  respectPoliteness: z.number().min(1).max(5),
  participationTeamwork: z.number().min(1).max(5),
  responsibility: z.number().min(1).max(5),
});

// Calendar event validation
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  eventDate: z.string().min(1, "Event date is required"),
  eventType: z.string().min(1, "Event type is required"),
  schoolId: z.string().optional(), // Optional - null means all schools
  isSystemWide: z.boolean().default(false),
});

// Updated grading utility functions
export const calculateGrade = (total: number): { grade: string; remark: string; color: string } => {
  if (total >= 75) return { grade: 'A1', remark: 'Excellent', color: 'bg-green-600' };
  if (total >= 70) return { grade: 'B2', remark: 'Very Good', color: 'bg-green-500' };
  if (total >= 65) return { grade: 'B3', remark: 'Good', color: 'bg-blue-500' };
  if (total >= 60) return { grade: 'C4', remark: 'Credit', color: 'bg-blue-400' };
  if (total >= 55) return { grade: 'C5', remark: 'Credit', color: 'bg-blue-300' };
  if (total >= 50) return { grade: 'C6', remark: 'Credit', color: 'bg-yellow-500' };
  if (total >= 45) return { grade: 'D7', remark: 'Pass', color: 'bg-orange-500' };
  if (total >= 40) return { grade: 'E8', remark: 'Pass', color: 'bg-orange-400' };
  return { grade: 'F9', remark: 'Fail', color: 'bg-red-500' };
};

// Non-academic rating text conversion
export const getRatingText = (rating: number): string => {
  switch (rating) {
    case 5: return 'Excellent';
    case 4: return 'Very Good';
    case 3: return 'Good';
    case 2: return 'Fair';
    case 1: return 'Poor';
    default: return 'Not Rated';
  }
};

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

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type AddAttendance = z.infer<typeof addAttendanceSchema>;

export type GeneratedReportCard = typeof generatedReportCards.$inferSelect;
export type InsertGeneratedReportCard = z.infer<typeof insertGeneratedReportCardSchema>;

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
export type RecordPaymentForm = z.infer<typeof recordPaymentSchema>;
export type AssignFeeForm = z.infer<typeof assignFeeSchema>;

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

// Settings types
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

// Academic Session and Term types
export type AcademicSession = typeof academicSessions.$inferSelect;
export type InsertAcademicSession = typeof academicSessions.$inferInsert;
export type AcademicTerm = typeof academicTerms.$inferSelect;
export type InsertAcademicTerm = typeof academicTerms.$inferInsert;

// Non-academic rating types
export type NonAcademicRating = typeof nonAcademicRatings.$inferSelect;
export type InsertNonAcademicRating = z.infer<typeof insertNonAcademicRatingSchema>;
export type UpdateNonAcademicRating = z.infer<typeof updateNonAcademicRatingSchema>;

// Calendar event types
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CreateCalendarEvent = z.infer<typeof createCalendarEventSchema>;

// Enhanced student with non-academic ratings
export type StudentWithFullDetails = StudentWithDetails & {
  nonAcademicRating?: NonAcademicRating;
  attendance?: Attendance;
};
