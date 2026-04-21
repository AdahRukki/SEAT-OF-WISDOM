import {
  schools,
  users,
  students,
  classes,
  subjects,
  classSubjects,
  assessments,
  attendance,
  reportCardTemplates,
  generatedReportCards,
  feeTypes,
  tuitionClassAmounts,
  studentFees,
  payments,
  settings,
  academicSessions,
  academicTerms,
  nonAcademicRatings,
  calendarEvents,
  passwordResetTokens,
  news,
  notifications,
  publishedScores,
  feePaymentRecords,
  feePaymentStudentSplits,
  paymentAuditLogs,
  paymentAllocations,
  bankStatements,
  bankTransactions,
  type School,
  type User,
  type Student,
  type Class,
  type Subject,
  type Assessment,
  type Attendance,
  type ReportCardTemplate,
  type GeneratedReportCard,
  type FeeType,
  type TuitionClassAmount,
  type StudentFee,
  type Payment,
  type Setting,
  type AcademicSession,
  type AcademicTerm,
  type NonAcademicRating,
  type CalendarEvent,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type InsertUser,
  type InsertStudent,
  type InsertClass,
  type InsertSubject,
  type InsertAssessment,
  type InsertAttendance,
  type InsertReportCardTemplate,
  type InsertGeneratedReportCard,
  type InsertFeeType,
  type InsertStudentFee,
  type InsertPayment,
  type InsertSetting,
  type InsertAcademicSession,
  type InsertAcademicTerm,
  type InsertNonAcademicRating,
  type InsertCalendarEvent,
  type News,
  type InsertNews,
  type Notification,
  type InsertNotification,
  type PublishedScore,
  type InsertPublishedScore,
  type StudentWithDetails,
  type StudentFeeWithDetails,
  type PaymentWithDetails,
  type FeePaymentRecord,
  type InsertFeePaymentRecord,
  type FeePaymentRecordWithDetails,
  type FeePaymentStudentSplit,
  type PaymentAuditLog,
  type InsertPaymentAuditLog,
  type BankStatement,
  type InsertBankStatement,
  type BankTransaction,
  type InsertBankTransaction,
  calculateGrade
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, inArray, ne, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import bcrypt from "bcrypt";
import crypto from "crypto";

export interface IStorage {
  // Authentication
  authenticateUser(email: string, password: string): Promise<User | null>;
  authenticateUserByStudentId(studentId: string, password: string): Promise<User | null>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<boolean>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  
  // Password reset operations
  createPasswordResetToken(userId: string): Promise<string>;
  verifyAndUsePasswordResetToken(token: string): Promise<string | null>;
  
  // School operations
  getAllSchools(): Promise<School[]>;
  getSchoolById(id: string): Promise<School | undefined>;
  
  // Admin operations
  getAllUsers(adminOnly?: boolean): Promise<(User & { school?: School })[]>;
  createUser(userData: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  updateSchoolLogo(schoolId: string, logoUrl: string): Promise<School>;
  updateSchoolPrincipalSignature(schoolId: string, signatureUrl: string): Promise<School>;
  createStudent(studentData: InsertStudent): Promise<Student>;
  updateStudent(studentId: string, updateData: Partial<InsertStudent>): Promise<Student>;
  updateStudentProfileImage(studentId: string, profileImagePath: string): Promise<Student>;
  getStudent(studentId: string): Promise<Student | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  deleteClass(classId: string): Promise<void>;
  createSubject(subjectData: InsertSubject): Promise<Subject>;
  assignSubjectToClass(classId: string, subjectId: string): Promise<void>;
  removeSubjectFromClass(classId: string, subjectId: string): Promise<void>;
  
  // Data retrieval (school-aware)
  getAllClasses(schoolId?: string): Promise<(Class & { school: School })[]>;
  getAllSubjects(): Promise<Subject[]>;
  updateSubject(id: string, name: string): Promise<Subject>;
  getInactiveStudentsWithDetails(schoolId?: string): Promise<StudentWithDetails[]>;
  getStudentsByClass(classId: string): Promise<StudentWithDetails[]>;
  getStudentByUserId(userId: string): Promise<StudentWithDetails | undefined>;
  getAllStudentsWithDetails(schoolId?: string): Promise<StudentWithDetails[]>;
  getClassSubjects(classId: string): Promise<Subject[]>;
  getClassAssessments(classId: string, subjectId: string, term: string, session: string): Promise<(Assessment & { student: StudentWithDetails })[]>;
  
  // Assessment operations
  createOrUpdateAssessment(assessmentData: InsertAssessment): Promise<Assessment>;
  deleteAssessment(assessmentId: string): Promise<void>;
  getStudentAssessments(studentId: string, term: string, session: string, classId?: string): Promise<(Assessment & { subject: Subject })[]>;
  getAssessmentsByClassTermSession(classId: string, term: string, session: string): Promise<(Assessment & { subject: Subject })[]>;
  getStudentEnrolledClasses(studentId: string): Promise<Class[]>;
  
  // Non-academic rating operations
  createOrUpdateNonAcademicRating(ratingData: InsertNonAcademicRating): Promise<NonAcademicRating>;
  getNonAcademicRatingsByClass(classId: string, term: string, session: string): Promise<NonAcademicRating[]>;
  getNonAcademicRatingByStudent(studentId: string, classId: string, term: string, session: string): Promise<NonAcademicRating | undefined>;
  
  // Calendar operations
  createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEvents(schoolId?: string): Promise<CalendarEvent[]>;
  
  // News operations
  createNews(newsData: InsertNews): Promise<News>;
  getAllNews(): Promise<(News & { author: Omit<User, 'password' | 'passwordUpdatedAt'> })[]>;
  getAllPublishedNews(): Promise<(News & { author: Omit<User, 'password' | 'passwordUpdatedAt'> })[]>;
  deleteNews(newsId: string): Promise<void>;
  
  // Notification operations
  createNotificationForAllStudents(message: string, schoolId?: string): Promise<Notification[]>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string): Promise<Notification>;
  
  // Published Scores operations
  publishScores(classId: string, term: string, session: string, publishedBy: string, nextTermResumes: Date): Promise<void>;
  unpublishScores(classId: string, term: string, session: string): Promise<void>;
  checkIfScoresPublished(classId: string, term: string, session: string): Promise<boolean>;
  getPublishedScoreInfo(classId: string, term: string, session: string): Promise<PublishedScore | undefined>;
  getPublishedScoresByClass(classId: string): Promise<any[]>;
  
  // Report card templates
  createReportCardTemplate(templateData: InsertReportCardTemplate): Promise<ReportCardTemplate>;
  getReportCardTemplates(): Promise<ReportCardTemplate[]>;
  getDefaultReportCardTemplate(): Promise<ReportCardTemplate | undefined>;
  
  // Financial management
  createFeeType(feeTypeData: InsertFeeType): Promise<FeeType>;
  getFeeTypes(schoolId?: string): Promise<FeeType[]>;
  getFeeTypeById(id: string): Promise<FeeType | undefined>;
  updateFeeType(id: string, data: Partial<InsertFeeType>): Promise<FeeType>;
  deleteFeeType(id: string): Promise<void>;
  getTuitionClassAmounts(feeTypeId: string, term?: string, session?: string): Promise<TuitionClassAmount[]>;
  upsertTuitionClassAmounts(feeTypeId: string, amounts: { classId: string; amount: string }[], term?: string, session?: string): Promise<TuitionClassAmount[]>;
  
  assignFeesToStudent(studentId: string, feeTypeId: string, term: string, session: string, amount?: number): Promise<StudentFee>;
  assignFeeToClass(classId: string, feeTypeId: string, term: string, session: string, dueDate: string, notes?: string): Promise<StudentFee[]>;
  getStudentFees(studentId: string, term?: string, session?: string, classId?: string): Promise<StudentFeeWithDetails[]>;
  getAllStudentFees(schoolId?: string, term?: string, session?: string): Promise<StudentFeeWithDetails[]>;
  updateStudentFeeStatus(id: string, status: string): Promise<StudentFee>;
  
  recordPayment(paymentData: InsertPayment): Promise<Payment>;
  getPayments(studentId?: string, studentFeeId?: string, schoolId?: string, term?: string, session?: string, classId?: string): Promise<PaymentWithDetails[]>;
  getPaymentById(id: string): Promise<PaymentWithDetails | undefined>;
  createFeePaymentWithSplits(record: Omit<InsertFeePaymentRecord, 'studentId'>, splits: Array<{ studentId: string; amount: number }>): Promise<FeePaymentRecord>;
  getSplitsForPaymentRecord(paymentRecordId: string): Promise<FeePaymentStudentSplit[]>;
  
  getStudentPaymentLedger(schoolId: string, classId?: string, term?: string, session?: string): Promise<{
    studentDbId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    className: string;
    classId: string;
    totalPaid: number;
    totalAssigned: number;
    balance: number;
    paymentCount: number;
    lastPaymentDate: string | null;
  }[]>;
  getPaymentBroadsheet(schoolId: string, term: string, session: string): Promise<{
    classes: Array<{
      classId: string;
      className: string;
      students: Array<{
        studentId: string;
        firstName: string;
        lastName: string;
        sowaId: string;
        totalAssigned: number;
        totalPaid: number;
        balance: number;
        status: 'paid' | 'partial' | 'unpaid';
      }>;
      classTotals: { totalAssigned: number; totalPaid: number; balance: number };
    }>;
    grandTotal: { totalAssigned: number; totalPaid: number; balance: number };
  }>;
  getFinancialSummary(schoolId?: string, term?: string, session?: string): Promise<{
    totalFees: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    totalRevenue: number;
    totalOutstanding: number;
    collectionRate: number;
    studentsOwing: number;
  }>;

  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;

  // Current academic info
  getCurrentAcademicInfo(schoolId?: string): Promise<{
    currentSession: string | null;
    currentTerm: string | null;
  }>;
  advanceAcademicTermForSchool(schoolId: string): Promise<{ newTerm: string; newSession: string }>;

  // Academic sessions and terms management
  createAcademicSession(sessionData: InsertAcademicSession): Promise<AcademicSession>;
  getAcademicSessions(): Promise<AcademicSession[]>;
  getActiveAcademicSession(): Promise<AcademicSession | undefined>;
  setActiveAcademicSession(sessionId: string): Promise<AcademicSession>;
  
  createAcademicTerm(termData: InsertAcademicTerm): Promise<AcademicTerm>;
  getAcademicTerms(sessionId?: string): Promise<AcademicTerm[]>;
  getActiveTerm(): Promise<AcademicTerm | undefined>;
  setActiveTerm(termId: string): Promise<AcademicTerm>;
  
  // Academic calendar management
  initializeAcademicCalendar(): Promise<{ session: string; term: string }>;
  advanceAcademicTerm(): Promise<{ newTerm: string; newSession: string }>;
  
  // Student promotion system
  promoteStudentsToNextClass(currentClassId: string, nextClassId: string, studentIds: string[]): Promise<void>;
  markStudentsAsGraduated(studentIds: string[]): Promise<void>;
  
  // Attendance tracking
  getStudentAttendance(studentId: string, term?: string, session?: string): Promise<Attendance[]>;
  getClassAttendance(classId: string, term: string, session: string): Promise<(Attendance & { student: StudentWithDetails })[]>;
  upsertAttendance(attendanceData: InsertAttendance): Promise<Attendance>;
  getAttendanceByStudent(studentId: string, term: string, session: string): Promise<Attendance | undefined>;

  // Report Card operations
  getAllGeneratedReportCards(schoolId?: string): Promise<GeneratedReportCard[]>;
  getGeneratedReportCardsByStudent(studentId: string): Promise<GeneratedReportCard[]>;
  getGeneratedReportCardsByClass(classId: string): Promise<GeneratedReportCard[]>;
  createGeneratedReportCard(reportCardData: InsertGeneratedReportCard): Promise<GeneratedReportCard>;
  deleteGeneratedReportCard(reportCardId: string): Promise<void>;
  validateReportCardData(studentId: string, classId: string, term: string, session: string): Promise<{ hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
  validateReportCardDataBulk(classId: string, term: string, session: string): Promise<{
    results: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
    summary: { total: number; ready: number; partial: number; incomplete: number };
  }>;
  validateReportCardDataSchool(term: string, session: string, schoolId?: string): Promise<{
    classes: Record<string, {
      className: string;
      totalStudents: number;
      validatedStudents: number;
      issues: string[];
    }>;
    studentResults: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
    summary: { totalStudents: number; readyStudents: number };
  }>;
  
  // Enhanced student creation helpers
  getSchoolNumber(schoolId: string): Promise<string>;
  getStudentCountForSchool(schoolId: string): Promise<number>;
  getClassById(classId: string): Promise<Class | undefined>;
  updateSchool(schoolId: string, data: Partial<School>): Promise<School>;
  updateUserProfile(userId: string, data: Partial<User>): Promise<User>;

  // Fee Payment Records (Payment Tracking & Reconciliation)
  recordFeePayment(data: InsertFeePaymentRecord): Promise<FeePaymentRecord>;
  getFeePaymentRecords(filters: { schoolId?: string; studentId?: string; status?: string; startDate?: Date; endDate?: Date; term?: string; session?: string }): Promise<FeePaymentRecordWithDetails[]>;
  getFeePaymentRecordById(id: string): Promise<FeePaymentRecordWithDetails | undefined>;
  confirmFeePayment(paymentId: string, bankTransactionId: string, confirmedBy: string): Promise<FeePaymentRecord>;
  reverseFeePayment(paymentId: string, reversedBy: string, reason: string): Promise<FeePaymentRecord>;
  createMultiStudentAllocation(bankTransactionId: string, allocations: Array<{ studentId: string; amount: number; term?: string; session?: string; notes?: string; }>, allocatedBy: string): Promise<{ paymentRecords: FeePaymentRecord[]; allocations: any[] }>;
  
  // Audit logging
  createPaymentAuditLog(data: InsertPaymentAuditLog): Promise<PaymentAuditLog>;

  // Bank Statement Upload & Management
  uploadBankStatement(data: { fileName: string; fileType: string; uploadedBy: string; schoolId?: string; dateRangeStart?: Date; dateRangeEnd?: Date; }): Promise<BankStatement>;
  getBankStatements(schoolId?: string): Promise<BankStatement[]>;
  updateBankStatementCounts(id: string, totalTransactions: number, newTransactions: number, duplicatesSkipped: number): Promise<BankStatement>;

  // Bank Transactions
  createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction>;
  getBankTransactions(filters: { schoolId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<BankTransaction[]>;
  getUnmatchedBankTransactions(schoolId?: string): Promise<BankTransaction[]>;
  updateBankTransactionStatus(id: string, status: string, matchConfidence?: number): Promise<BankTransaction>;
  checkTransactionFingerprint(fingerprint: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async authenticateUser(email: string, password: string): Promise<User | null> {
    // Case-insensitive email lookup using SQL lower() function
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
    if (!user || !user.isActive) return null;
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    return isValidPassword ? user : null;
  }

  async authenticateUserByStudentId(studentId: string, password: string): Promise<User | null> {
    // Find student by student ID
    const [student] = await db.select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.studentId, studentId));
    
    if (!student || !student.users || !student.users.isActive) return null;
    
    const isValidPassword = await bcrypt.compare(password, student.users.password);
    return isValidPassword ? student.users : null;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return false;
    
    return await bcrypt.compare(password, user.password);
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        passwordUpdatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token for storage
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Store the hashed token in database
    await db.insert(passwordResetTokens).values({
      userId,
      tokenHash: hashedToken,
      expiresAt
    });
    
    // Return the plain token (to be sent in email)
    return resetToken;
  }

  async verifyAndUsePasswordResetToken(token: string): Promise<string | null> {
    // Get all non-expired, unused tokens
    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.usedAt, null),
          sql`${passwordResetTokens.expiresAt} > NOW()`
        )
      );
    
    // Check each token to find a match
    for (const dbToken of tokens) {
      const isValidToken = await bcrypt.compare(token, dbToken.tokenHash);
      
      if (isValidToken) {
        // Mark token as used
        await db
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, dbToken.id));
        
        return dbToken.userId;
      }
    }
    
    // No matching token found
    return null;
  }


  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...userData, password: hashedPassword })
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }



  async createStudent(studentData: InsertStudent): Promise<Student> {
    // Auto-generate student ID if not provided
    if (!studentData.studentId) {
      // Get the school through the class to determine the school number
      const classData = await db
        .select({ schoolId: classes.schoolId })
        .from(classes)
        .where(eq(classes.id, studentData.classId!))
        .limit(1);
      
      if (classData.length === 0) {
        throw new Error('Class not found');
      }
      
      const schoolId = classData[0].schoolId;
      
      // Use the authoritative getSchoolNumber function
      const schoolNumber = await this.getSchoolNumber(schoolId);
      
      // Get existing students for this school to determine next number
      const existingStudents = await db
        .select()
        .from(students)
        .leftJoin(classes, eq(students.classId, classes.id))
        .where(eq(classes.schoolId, schoolId));
      
      // Extract existing numbers for this school to find gaps
      const existingNumbers: number[] = [];
      const schoolPrefix = `SOWA/${schoolNumber}`;
      
      existingStudents.forEach((row) => {
        const studentId = row.students?.studentId;
        if (studentId && studentId.startsWith(schoolPrefix)) {
          // Extract number from format SOWA/1001 (school number + sequence)
          const numberPart = studentId.substring(schoolPrefix.length);
          // Ensure the remaining part is ONLY digits (prevents matching School 41 when checking School 4)
          if (/^\d+$/.test(numberPart)) {
            const num = parseInt(numberPart, 10);
            if (!isNaN(num)) {
              existingNumbers.push(num);
            }
          }
        }
      });
      
      // Sort numbers to find gaps
      existingNumbers.sort((a, b) => a - b);
      
      // Find the lowest available number (fill gaps first)
      let nextNumber = 1;
      for (const num of existingNumbers) {
        if (num === nextNumber) {
          nextNumber++;
        } else if (num > nextNumber) {
          // Found a gap, use it
          break;
        }
      }
      
      // Format as 3-digit number (e.g., 001, 002, 123)
      studentData.studentId = `SOWA/${schoolNumber}${nextNumber.toString().padStart(3, '0')}`;
    }
    
    const [student] = await db
      .insert(students)
      .values(studentData)
      .returning();
    return student;
  }

  async updateStudent(studentId: string, updateData: Partial<InsertStudent>): Promise<Student> {
    const [updatedStudent] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, studentId))
      .returning();
    
    if (!updatedStudent) {
      throw new Error('Student not found');
    }
    
    return updatedStudent;
  }

  async updateStudentProfileImage(studentId: string, profileImagePath: string): Promise<Student> {
    const [updatedStudent] = await db
      .update(students)
      .set({ profileImage: profileImagePath })
      .where(eq(students.id, studentId))
      .returning();
    
    if (!updatedStudent) {
      throw new Error('Student not found');
    }
    
    return updatedStudent;
  }

  async getStudent(studentId: string): Promise<Student | undefined> {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    
    return student;
  }

  async createClass(classData: InsertClass): Promise<Class> {
    // Auto-generate human-readable class ID if not provided
    if (!classData.id) {
      // Get school info to create readable ID
      const school = await this.getSchoolById(classData.schoolId!);
      const schoolNumber = school?.name.match(/School (\d+)/)?.[1] || '1';
      
      // Extract class type from name (J.S.S -> JSS, Senior -> SS, etc.)
      let classPrefix = 'CLS';
      if (classData.name?.toLowerCase().includes('j.s.s') || classData.name?.toLowerCase().includes('junior')) {
        classPrefix = 'JSS';
      } else if (classData.name?.toLowerCase().includes('senior') || classData.name?.toLowerCase().includes('s.s.s')) {
        classPrefix = 'SS';
      } else if (classData.name?.toLowerCase().includes('primary')) {
        classPrefix = 'PRI';
      }
      
      // Get existing classes for this school and prefix to find next available number
      const existingClasses = await db.select().from(classes).where(eq(classes.schoolId, classData.schoolId!));
      const existingNumbers = existingClasses
        .filter(c => c.id.startsWith(`SCH${schoolNumber}-${classPrefix}`))
        .map(c => {
          const match = c.id.match(/(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      
      // Find next available number
      let nextNumber = 1;
      while (existingNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      
      // Create readable ID: SCH1-JSS1, SCH2-SS2, etc.
      classData.id = `SCH${schoolNumber}-${classPrefix}${nextNumber}`;
    }
    
    const [classRecord] = await db
      .insert(classes)
      .values(classData)
      .returning();
    return classRecord;
  }

  async deleteClass(classId: string): Promise<void> {
    await db.delete(classes).where(eq(classes.id, classId));
  }

  async createSubject(subjectData: InsertSubject): Promise<Subject> {
    const [subject] = await db
      .insert(subjects)
      .values(subjectData)
      .returning();
    return subject;
  }

  async assignSubjectToClass(classId: string, subjectId: string): Promise<void> {
    // Check if this subject is already assigned to this class
    const existing = await db.select()
      .from(classSubjects)
      .where(and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, subjectId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      throw new Error('This subject is already assigned to this class');
    }
    
    await db.insert(classSubjects).values({ classId, subjectId });
  }

  async removeSubjectFromClass(classId: string, subjectId: string): Promise<void> {
    // First, get all students in this class
    const classStudents = await db.select({ id: students.id })
      .from(students)
      .where(eq(students.classId, classId));
    
    // Delete all scores for these students for this subject
    if (classStudents.length > 0) {
      const studentIds = classStudents.map(s => s.id);
      await db.delete(assessments).where(
        and(
          inArray(assessments.studentId, studentIds),
          eq(assessments.subjectId, subjectId)
        )
      );
    }
    
    // Then remove the class-subject mapping
    await db.delete(classSubjects).where(
      and(
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, subjectId)
      )
    );
  }

  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools).orderBy(asc(schools.sortOrder), asc(schools.name));
  }


  async getSchoolById(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school || undefined;
  }

  async getAllUsers(adminOnly: boolean = false): Promise<(User & { school?: School })[]> {
    let query = db
      .select({
        id: users.id,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        schoolId: users.schoolId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
          address: schools.address,
          phone: schools.phone,
          email: schools.email,
          logoUrl: schools.logoUrl,
          createdAt: schools.createdAt,
          updatedAt: schools.updatedAt,
        }
      })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id));

    if (adminOnly) {
      query = query.where(inArray(users.role, ['admin', 'sub-admin']));
    }

    const result = await query;

    return result.map(row => ({
      ...row,
      school: row.school && row.school.id ? row.school : undefined
    }));
  }

  async updateSchoolLogo(schoolId: string, logoUrl: string): Promise<School> {
    const [school] = await db
      .update(schools)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(schools.id, schoolId))
      .returning();
    return school;
  }

  async updateSchoolPrincipalSignature(schoolId: string, signatureUrl: string): Promise<School> {
    const [school] = await db
      .update(schools)
      .set({ principalSignature: signatureUrl, updatedAt: new Date() })
      .where(eq(schools.id, schoolId))
      .returning();
    return school;
  }

  async getAllClasses(schoolId?: string): Promise<(Class & { school: School })[]> {
    const baseQuery = db.select({
      id: classes.id,
      name: classes.name,
      description: classes.description,
      schoolId: classes.schoolId,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
      school: {
        id: schools.id,
        name: schools.name,
        address: schools.address,
        phone: schools.phone,
        email: schools.email,
        logoUrl: schools.logoUrl,
        sortOrder: schools.sortOrder,
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
      }
    }).from(classes).innerJoin(schools, eq(classes.schoolId, schools.id));
    
    if (schoolId) {
      return await baseQuery.where(eq(classes.schoolId, schoolId));
    }
    return await baseQuery;
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async updateSubject(id: string, name: string): Promise<Subject> {
    const [updated] = await db.update(subjects)
      .set({ name, updatedAt: new Date() })
      .where(eq(subjects.id, id))
      .returning();
    if (!updated) throw new Error("Subject not found");
    return updated;
  }






  async getStudentsByClass(classId: string): Promise<StudentWithDetails[]> {
    const studentsData = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(and(eq(students.classId, classId), eq(users.isActive, true)));

    return studentsData.map(({ students: student, users: user, classes: classData }) => ({
      ...student,
      user: user!,
      class: classData!,
      assessments: []
    }));
  }

  async getStudentByUserId(userId: string): Promise<StudentWithDetails | undefined> {
    const [studentData] = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.userId, userId));

    if (!studentData) return undefined;

    const { students: student, users: user, classes: classData } = studentData;
    
    return {
      ...student,
      user: user!,
      class: classData!,
      assessments: []
    };
  }

  async getStudentByStudentId(studentId: string): Promise<(Student & { user: User }) | undefined> {
    const [result] = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.studentId, studentId));
    
    if (!result || !result.students || !result.users) {
      return undefined;
    }
    
    return {
      ...result.students,
      user: result.users
    };
  }



  async createOrUpdateAssessment(assessmentData: InsertAssessment): Promise<Assessment> {
    console.log("[DEBUG] Storage createOrUpdateAssessment called with:", assessmentData);
    console.log("[DEBUG] ClassId specifically:", assessmentData.classId);
    
    // Check if assessment already exists
    const [existing] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.studentId, assessmentData.studentId),
          eq(assessments.subjectId, assessmentData.subjectId),
          eq(assessments.term, assessmentData.term),
          eq(assessments.session, assessmentData.session)
        )
      );

    if (existing) {
      // MERGE new values with existing values - only update fields that have real values
      // This fixes the bug where editing one field (e.g., CA2) would clear others (CA1, Exam)
      const mergedFirstCA = (assessmentData.firstCA !== undefined && assessmentData.firstCA !== null && Number(assessmentData.firstCA) > 0) 
        ? Number(assessmentData.firstCA) 
        : existing.firstCA;
      const mergedSecondCA = (assessmentData.secondCA !== undefined && assessmentData.secondCA !== null && Number(assessmentData.secondCA) > 0) 
        ? Number(assessmentData.secondCA) 
        : existing.secondCA;
      const mergedExam = (assessmentData.exam !== undefined && assessmentData.exam !== null && Number(assessmentData.exam) > 0) 
        ? Number(assessmentData.exam) 
        : existing.exam;
      
      const total = Number(mergedFirstCA || 0) + Number(mergedSecondCA || 0) + Number(mergedExam || 0);
      const grade = total >= 75 ? 'A' : total >= 50 ? 'C' : total >= 40 ? 'P' : 'F';

      // Update existing assessment with merged values
      const [updated] = await db
        .update(assessments)
        .set({
          classId: assessmentData.classId,
          firstCA: mergedFirstCA,
          secondCA: mergedSecondCA,
          exam: mergedExam,
          total,
          grade,
          updatedAt: new Date()
        })
        .where(eq(assessments.id, existing.id))
        .returning();
      
      console.log("[DEBUG] Merged update - existing:", { firstCA: existing.firstCA, secondCA: existing.secondCA, exam: existing.exam });
      console.log("[DEBUG] Merged update - incoming:", { firstCA: assessmentData.firstCA, secondCA: assessmentData.secondCA, exam: assessmentData.exam });
      console.log("[DEBUG] Merged update - result:", { firstCA: mergedFirstCA, secondCA: mergedSecondCA, exam: mergedExam });
      
      return updated;
    } else {
      // For new assessments, use the provided values
      const total = Number(assessmentData.firstCA || 0) + 
                    Number(assessmentData.secondCA || 0) + 
                    Number(assessmentData.exam || 0);
      const grade = total >= 75 ? 'A' : total >= 50 ? 'C' : total >= 40 ? 'P' : 'F';
      // Create new assessment
      const [assessment] = await db
        .insert(assessments)
        .values({
          ...assessmentData,
          total,
          grade
        })
        .returning();
      return assessment;
    }
  }

  async deleteAssessment(assessmentId: string): Promise<void> {
    await db.delete(assessments).where(eq(assessments.id, assessmentId));
  }

  async getStudentAssessments(studentId: string, term: string, session: string, classId?: string): Promise<(Assessment & { subject: Subject })[]> {
    const conditions = [
      eq(assessments.studentId, studentId),
      eq(assessments.term, term),
      eq(assessments.session, session)
    ];

    if (classId) {
      conditions.push(eq(assessments.classId, classId));
    }

    const assessmentData = await db
      .select()
      .from(assessments)
      .leftJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(and(...conditions));

    // Filter to only include subjects currently assigned to the class
    if (classId) {
      const assignedSubjects = await db
        .select({ subjectId: classSubjects.subjectId })
        .from(classSubjects)
        .where(eq(classSubjects.classId, classId));
      
      const assignedSubjectIds = new Set(assignedSubjects.map(s => s.subjectId));
      
      return assessmentData
        .filter(({ assessments: assessment }) => assignedSubjectIds.has(assessment.subjectId))
        .map(({ assessments: assessment, subjects: subject }) => ({
          ...assessment,
          subject: subject!
        }));
    }

    return assessmentData.map(({ assessments: assessment, subjects: subject }) => ({
      ...assessment,
      subject: subject!
    }));
  }

  async getStudentEnrolledClasses(studentId: string): Promise<Class[]> {
    // Get student's current class
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    const currentClassId = student[0]?.classId;
    
    // Get distinct class IDs from student's assessments history (filter out nulls)
    const assessmentClasses = await db
      .selectDistinct({ classId: assessments.classId })
      .from(assessments)
      .where(eq(assessments.studentId, studentId));

    // Filter out null class IDs and combine with current class
    const validClassIds = assessmentClasses
      .map(c => c.classId)
      .filter((id): id is string => id !== null);
    
    // Add current class if not already in the list
    if (currentClassId && !validClassIds.includes(currentClassId)) {
      validClassIds.push(currentClassId);
    }

    if (validClassIds.length === 0) {
      return [];
    }

    // Fetch class details using inArray for safe parameter binding
    const classDetails = await db
      .select()
      .from(classes)
      .where(inArray(classes.id, validClassIds));

    return classDetails;
  }

  async createReportCardTemplate(templateData: InsertReportCardTemplate): Promise<ReportCardTemplate> {
    const [template] = await db
      .insert(reportCardTemplates)
      .values(templateData)
      .returning();
    return template;
  }

  async getReportCardTemplates(): Promise<ReportCardTemplate[]> {
    return await db.select().from(reportCardTemplates);
  }

  async getDefaultReportCardTemplate(): Promise<ReportCardTemplate | undefined> {
    const [template] = await db
      .select()
      .from(reportCardTemplates)
      .where(eq(reportCardTemplates.isDefault, true));
    return template || undefined;
  }

  async getAllStudentsWithDetails(schoolId?: string): Promise<StudentWithDetails[]> {
    let query = db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id));

    if (schoolId) {
      query = query.where(and(eq(classes.schoolId, schoolId), eq(users.isActive, true)));
    } else {
      query = query.where(eq(users.isActive, true));
    }

    const studentsData = await query;

    return studentsData.map(({ students: student, users: user, classes: classData }) => ({
      ...student,
      user: user!,
      class: classData!,
      assessments: [] // Will be populated separately if needed
    }));
  }

  async getInactiveStudentsWithDetails(schoolId?: string): Promise<StudentWithDetails[]> {
    let query = db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id));

    if (schoolId) {
      query = query.where(and(eq(classes.schoolId, schoolId), eq(users.isActive, false)));
    } else {
      query = query.where(eq(users.isActive, false));
    }

    const studentsData = await query;

    return studentsData.map(({ students: student, users: user, classes: classData }) => ({
      ...student,
      user: user!,
      class: classData!,
      assessments: []
    }));
  }

  async getClassSubjects(classId: string): Promise<Subject[]> {
    const subjectsData = await db
      .select()
      .from(subjects)
      .innerJoin(classSubjects, eq(subjects.id, classSubjects.subjectId))
      .where(eq(classSubjects.classId, classId));

    return subjectsData.map(({ subjects: subject }) => subject);
  }

  async getClassAssessments(classId: string, subjectId: string, term: string, session: string): Promise<(Assessment & { student: StudentWithDetails })[]> {
    const assessmentsData = await db
      .select()
      .from(assessments)
      .leftJoin(students, eq(assessments.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(
        and(
          eq(assessments.classId, classId),
          eq(assessments.subjectId, subjectId),
          eq(assessments.term, term),
          eq(assessments.session, session),
          eq(users.isActive, true)
        )
      );

    return assessmentsData.map(({ assessments: assessment, students: student, users: user, classes: classData }) => ({
      ...assessment,
      student: {
        ...student!,
        user: user!,
        class: classData!,
        assessments: [] // Will be populated separately if needed
      }
    }));
  }

  // Financial management methods
  async createFeeType(feeTypeData: InsertFeeType): Promise<FeeType> {
    const [feeType] = await db
      .insert(feeTypes)
      .values(feeTypeData)
      .returning();
    return feeType;
  }

  async getFeeTypes(schoolId?: string): Promise<FeeType[]> {
    if (schoolId) {
      return await db
        .select()
        .from(feeTypes)
        .where(and(eq(feeTypes.schoolId, schoolId), eq(feeTypes.isActive, true)));
    }
    return await db.select().from(feeTypes).where(eq(feeTypes.isActive, true));
  }

  async getFeeTypeById(id: string): Promise<FeeType | undefined> {
    const [feeType] = await db.select().from(feeTypes).where(eq(feeTypes.id, id));
    return feeType || undefined;
  }

  async updateFeeType(id: string, data: Partial<InsertFeeType>): Promise<FeeType> {
    const [updated] = await db
      .update(feeTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(feeTypes.id, id))
      .returning();
    return updated;
  }

  async deleteFeeType(id: string): Promise<void> {
    await db.update(feeTypes).set({ isActive: false }).where(eq(feeTypes.id, id));
  }

  async getTuitionClassAmounts(feeTypeId: string, term?: string, session?: string): Promise<TuitionClassAmount[]> {
    const conditions: any[] = [eq(tuitionClassAmounts.feeTypeId, feeTypeId)];
    if (term) conditions.push(eq(tuitionClassAmounts.term, term));
    if (session) conditions.push(eq(tuitionClassAmounts.session, session));
    return await db.select().from(tuitionClassAmounts).where(and(...conditions));
  }

  async upsertTuitionClassAmounts(
    feeTypeId: string,
    amounts: { classId: string; amount: string }[],
    term?: string,
    session?: string
  ): Promise<TuitionClassAmount[]> {
    await db.delete(tuitionClassAmounts).where(
      and(
        eq(tuitionClassAmounts.feeTypeId, feeTypeId),
        term ? eq(tuitionClassAmounts.term, term) : sql`true`,
        session ? eq(tuitionClassAmounts.session, session) : sql`true`
      )
    );
    if (amounts.length === 0) return [];
    const rows = amounts.map(a => ({
      feeTypeId,
      classId: a.classId,
      amount: a.amount,
      term: term || null,
      session: session || null,
    }));
    return await db.insert(tuitionClassAmounts).values(rows).returning();
  }

  async assignFeesToStudent(studentId: string, feeTypeId: string, term: string, session: string, amount?: number): Promise<StudentFee> {
    // Get the fee type to determine amount if not provided
    const feeType = await this.getFeeTypeById(feeTypeId);
    const finalAmount = amount || (feeType ? Number(feeType.amount) : 0);

    const [studentFee] = await db
      .insert(studentFees)
      .values({
        studentId,
        feeTypeId,
        term,
        session,
        amount: finalAmount.toString(),
        status: 'pending'
      })
      .returning();
    return studentFee;
  }

  async assignFeeToClass(classId: string, feeTypeId: string, term: string, session: string, dueDate: string, notes?: string): Promise<StudentFee[]> {
    // Get all students in the class
    const classStudents = await this.getStudentsByClass(classId);
    
    // Get the fee type to determine amount
    const feeType = await this.getFeeTypeById(feeTypeId);
    if (!feeType) {
      throw new Error('Fee type not found');
    }

    const studentFeePromises = classStudents.map(async (student) => {
      // Check if student already has this fee for this term and session
      const existingFees = await this.getStudentFees(student.id, term, session);
      const hasExistingFee = existingFees.some(fee => fee.feeTypeId === feeTypeId);
      
      if (!hasExistingFee) {
        return await db
          .insert(studentFees)
          .values({
            studentId: student.id,
            feeTypeId,
            term,
            session,
            amount: feeType.amount,
            status: 'pending',
            dueDate: new Date(dueDate),
            notes
          })
          .returning();
      }
      return null;
    });

    const results = await Promise.all(studentFeePromises);
    return results.filter(result => result !== null).flat();
  }

  async getStudentFees(studentId: string, term?: string, session?: string, classId?: string): Promise<StudentFeeWithDetails[]> {
    const conditions = [eq(studentFees.studentId, studentId)];
    if (term) conditions.push(eq(studentFees.term, term));
    if (session) conditions.push(eq(studentFees.session, session));
    // Note: classId not used for fees filtering as fees follow the student regardless of class

    const results = await db
      .select()
      .from(studentFees)
      .leftJoin(feeTypes, eq(studentFees.feeTypeId, feeTypes.id))
      .leftJoin(students, eq(studentFees.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    // Get payments for each student fee
    const studentFeeIds = results.map(r => r.student_fees.id);
    const paymentsResults = studentFeeIds.length > 0 ? 
      await db.select().from(payments).where(inArray(payments.studentFeeId, studentFeeIds)) : [];

    return results.map(({ student_fees: studentFee, fee_types: feeType, students: student, users: user }) => ({
      ...studentFee,
      feeType: feeType!,
      student: {
        ...student!,
        user: user!
      },
      payments: paymentsResults.filter(p => p.studentFeeId === studentFee.id)
    }));
  }

  async getAllStudentFees(schoolId?: string, term?: string, session?: string): Promise<StudentFeeWithDetails[]> {
    const conditions = [];
    if (schoolId) conditions.push(eq(classes.schoolId, schoolId));
    if (term) conditions.push(eq(studentFees.term, term));
    if (session) conditions.push(eq(studentFees.session, session));

    let query = db
      .select()
      .from(studentFees)
      .leftJoin(feeTypes, eq(studentFees.feeTypeId, feeTypes.id))
      .leftJoin(students, eq(studentFees.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    return results.map(({ student_fees: studentFee, fee_types: feeType, students: student, users: user }) => ({
      ...studentFee,
      feeType: feeType!,
      student: {
        ...student!,
        user: user!
      },
      payments: []
    }));
  }

  async updateStudentFeeStatus(id: string, status: string): Promise<StudentFee> {
    const [updated] = await db
      .update(studentFees)
      .set({ status, updatedAt: new Date() })
      .where(eq(studentFees.id, id))
      .returning();
    return updated;
  }

  async recordPayment(paymentData: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(paymentData)
      .returning();

    // Update the student fee status if fully paid
    const studentFee = await db.select().from(studentFees).where(eq(studentFees.id, paymentData.studentFeeId));
    if (studentFee.length > 0) {
      const totalPaid = await this.getTotalPaidForStudentFee(paymentData.studentFeeId);
      const feeAmount = Number(studentFee[0].amount);
      
      if (totalPaid >= feeAmount) {
        await this.updateStudentFeeStatus(paymentData.studentFeeId, 'paid');
      }
    }

    return payment;
  }

  async getTotalPaidForStudentFee(studentFeeId: string): Promise<number> {
    const paymentsResult = await db
      .select()
      .from(payments)
      .where(eq(payments.studentFeeId, studentFeeId));
    
    return paymentsResult.reduce((total, payment) => total + Number(payment.amount), 0);
  }

  async getPayments(studentId?: string, studentFeeId?: string, schoolId?: string, term?: string, session?: string, classId?: string): Promise<PaymentWithDetails[]> {
    const conditions = [];
    if (studentId) conditions.push(eq(payments.studentId, studentId));
    if (studentFeeId) conditions.push(eq(payments.studentFeeId, studentFeeId));
    if (term) conditions.push(eq(studentFees.term, term));
    if (session) conditions.push(eq(studentFees.session, session));
    if (schoolId) conditions.push(eq(feeTypes.schoolId, schoolId));
    // Note: classId not used for payments filtering as payments follow the student regardless of class

    const results = await db
      .select()
      .from(payments)
      .leftJoin(studentFees, eq(payments.studentFeeId, studentFees.id))
      .leftJoin(feeTypes, eq(studentFees.feeTypeId, feeTypes.id))
      .leftJoin(students, eq(payments.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payments.paymentDate));

    const recordedByUserIds = results.map(r => r.payments.recordedBy).filter(Boolean) as string[];
    const uniqueRecordedByIds = Array.from(new Set(recordedByUserIds));
    
    const recordedByUsers: Record<string, any> = {};
    if (uniqueRecordedByIds.length > 0) {
      const recordedByUsersData = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(sql`${users.id} IN ${uniqueRecordedByIds}`);
      
      recordedByUsersData.forEach(u => {
        recordedByUsers[u.id] = u;
      });
    }

    return results.map(({ payments: payment, student_fees: studentFee, fee_types: feeType, students: student, users: user }) => ({
      ...payment,
      studentFee: studentFee ? {
        ...studentFee,
        feeType: feeType
      } : null,
      student: student ? {
        ...student,
        user: user
      } : null,
      recordedBy: payment.recordedBy ? recordedByUsers[payment.recordedBy] : null
    }));
  }

  async getPaymentById(id: string): Promise<PaymentWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(payments)
      .leftJoin(studentFees, eq(payments.studentFeeId, studentFees.id))
      .leftJoin(feeTypes, eq(studentFees.feeTypeId, feeTypes.id))
      .leftJoin(students, eq(payments.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(payments.id, id));

    if (!result) return undefined;

    const { payments: payment, student_fees: studentFee, fee_types: feeType, students: student, users: user } = result;

    return {
      ...payment,
      studentFee: {
        ...studentFee!,
        feeType: feeType!
      },
      student: {
        ...student!,
        user: user!
      }
    };
  }

  async getStudentPaymentLedger(schoolId: string, classId?: string, term?: string, session?: string): Promise<{
    studentDbId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    className: string;
    classId: string;
    totalPaid: number;
    totalAssigned: number;
    tuitionAssigned: number;
    balance: number;
    paymentCount: number;
    lastPaymentDate: string | null;
  }[]> {
    const paymentConditions = [
      sql`fpr.school_id = ${schoolId}`,
      sql`fpr.status = 'confirmed'`,
    ];
    if (term) paymentConditions.push(sql`fpr.term = ${term}`);
    if (session) paymentConditions.push(sql`fpr.session = ${session}`);

    const studentConditions = [
      sql`u.is_active = true`,
      sql`u.school_id = ${schoolId}`,
    ];
    if (classId) studentConditions.push(sql`s.class_id = ${classId}`);

    const paymentJoinClause = paymentConditions.map(c => c).reduce((a, b) => sql`${a} AND ${b}`);
    const studentWhereClause = studentConditions.map(c => c).reduce((a, b) => sql`${a} AND ${b}`);

    const rows = await db.execute(sql`
      SELECT
        s.id AS "studentDbId",
        s.student_id AS "studentId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        c.name AS "className",
        s.class_id AS "classId",
        (
          COALESCE((
            SELECT SUM(fpr.amount) FROM fee_payment_records fpr
            WHERE fpr.student_id = s.id AND ${paymentJoinClause}
          ), 0)
          +
          COALESCE((
            SELECT SUM(fpss.amount) FROM fee_payment_student_splits fpss
            JOIN fee_payment_records fpr2 ON fpr2.id = fpss.payment_record_id
            WHERE fpss.student_id = s.id
              AND fpr2.school_id = ${schoolId}
              AND fpr2.status = 'confirmed'
              ${term ? sql`AND fpr2.term = ${term}` : sql``}
              ${session ? sql`AND fpr2.session = ${session}` : sql``}
          ), 0)
        )::numeric AS "totalPaid",
        (
          COALESCE((
            SELECT COUNT(fpr.id) FROM fee_payment_records fpr
            WHERE fpr.student_id = s.id AND ${paymentJoinClause}
          ), 0)
          +
          COALESCE((
            SELECT COUNT(fpss.id) FROM fee_payment_student_splits fpss
            JOIN fee_payment_records fpr2 ON fpr2.id = fpss.payment_record_id
            WHERE fpss.student_id = s.id
              AND fpr2.school_id = ${schoolId}
              AND fpr2.status = 'confirmed'
              ${term ? sql`AND fpr2.term = ${term}` : sql``}
              ${session ? sql`AND fpr2.session = ${session}` : sql``}
          ), 0)
        )::int AS "paymentCount",
        COALESCE(
          GREATEST(
            (SELECT MAX(fpr.payment_date) FROM fee_payment_records fpr
             WHERE fpr.student_id = s.id AND ${paymentJoinClause}),
            (SELECT MAX(fpr2.payment_date) FROM fee_payment_student_splits fpss
             JOIN fee_payment_records fpr2 ON fpr2.id = fpss.payment_record_id
             WHERE fpss.student_id = s.id
               AND fpr2.school_id = ${schoolId}
               AND fpr2.status = 'confirmed'
               ${term ? sql`AND fpr2.term = ${term}` : sql``}
               ${session ? sql`AND fpr2.session = ${session}` : sql``})
          ),
          (SELECT MAX(fpr.payment_date) FROM fee_payment_records fpr
           WHERE fpr.student_id = s.id AND ${paymentJoinClause}),
          (SELECT MAX(fpr2.payment_date) FROM fee_payment_student_splits fpss
           JOIN fee_payment_records fpr2 ON fpr2.id = fpss.payment_record_id
           WHERE fpss.student_id = s.id
             AND fpr2.school_id = ${schoolId}
             AND fpr2.status = 'confirmed'
             ${term ? sql`AND fpr2.term = ${term}` : sql``}
             ${session ? sql`AND fpr2.session = ${session}` : sql``})
        ) AS "lastPaymentDate",
        COALESCE((
          SELECT SUM(sf.amount) FROM student_fees sf
          WHERE sf.student_id = s.id
            ${term ? sql`AND sf.term = ${term}` : sql``}
            ${session ? sql`AND sf.session = ${session}` : sql``}
        ), 0)::numeric AS "sfAssigned"
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE ${studentWhereClause}
      GROUP BY s.id, s.student_id, u.first_name, u.last_name, c.name, s.class_id
      ORDER BY c.name ASC, u.last_name ASC, u.first_name ASC
    `);

    const tuitionFeeRows = await db.execute(sql`
      SELECT ft.id FROM fee_types ft
      WHERE ft.school_id = ${schoolId} AND ft.is_tuition = true AND ft.is_active = true
      LIMIT 1
    `);
    const tuitionFee = ((tuitionFeeRows as any).rows || tuitionFeeRows)[0];

    let tuitionMap = new Map<string, number>();
    if (tuitionFee) {
      const tuitionAmts = await this.getTuitionClassAmounts(tuitionFee.id, term, session);
      tuitionMap = new Map(tuitionAmts.map(ta => [ta.classId, Number(ta.amount)]));
    }

    return (rows.rows || rows).map((r: any) => {
      const totalPaid = Number(r.totalPaid) || 0;
      const sfAssigned = Number(r.sfAssigned) || 0;
      const tuitionAssigned = tuitionMap.get(r.classId) || 0;
      const totalAssigned = sfAssigned + tuitionAssigned;
      return {
        studentDbId: r.studentDbId,
        studentId: r.studentId,
        firstName: r.firstName,
        lastName: r.lastName,
        className: r.className || '',
        classId: r.classId,
        totalPaid,
        totalAssigned,
        tuitionAssigned,
        balance: Math.max(0, totalAssigned - totalPaid),
        paymentCount: Number(r.paymentCount) || 0,
        lastPaymentDate: r.lastPaymentDate ? new Date(r.lastPaymentDate).toISOString() : null,
      };
    });
  }

  async getPaymentBroadsheet(schoolId: string, term: string, session: string): Promise<{
    classes: Array<{
      classId: string;
      className: string;
      students: Array<{
        studentId: string;
        firstName: string;
        lastName: string;
        sowaId: string;
        totalAssigned: number;
        totalPaid: number;
        balance: number;
        status: 'paid' | 'partial' | 'unpaid';
      }>;
      classTotals: { totalAssigned: number; totalPaid: number; balance: number };
    }>;
    grandTotal: { totalAssigned: number; totalPaid: number; balance: number };
  }> {
    const studentsRows = await db.execute(sql`
      SELECT s.id, s.student_id AS "sowaId", s.class_id AS "classId",
             u.first_name AS "firstName", u.last_name AS "lastName",
             c.name AS "className"
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE u.is_active = true AND u.school_id = ${schoolId}
      ORDER BY c.name ASC, u.last_name ASC, u.first_name ASC
    `);

    const feesRows = await db.execute(sql`
      SELECT sf.student_id AS "studentId", COALESCE(SUM(sf.amount), 0)::numeric AS "totalAssigned"
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE u.school_id = ${schoolId} AND sf.term = ${term} AND sf.session = ${session}
      GROUP BY sf.student_id
    `);

    const paymentsRows = await db.execute(sql`
      SELECT student_id AS "studentId", COALESCE(SUM(amount), 0)::numeric AS "totalPaid"
      FROM (
        SELECT fpr.student_id, fpr.amount
        FROM fee_payment_records fpr
        WHERE fpr.school_id = ${schoolId} AND fpr.status = 'confirmed'
          AND fpr.term = ${term} AND fpr.session = ${session}
          AND fpr.student_id IS NOT NULL
        UNION ALL
        SELECT fpss.student_id, fpss.amount
        FROM fee_payment_student_splits fpss
        JOIN fee_payment_records fpr2 ON fpr2.id = fpss.payment_record_id
        WHERE fpr2.school_id = ${schoolId} AND fpr2.status = 'confirmed'
          AND fpr2.term = ${term} AND fpr2.session = ${session}
      ) combined
      GROUP BY student_id
    `);

    const tuitionFeeRows = await db.execute(sql`
      SELECT ft.id, ft.name FROM fee_types ft
      WHERE ft.school_id = ${schoolId} AND ft.is_tuition = true AND ft.is_active = true
      LIMIT 1
    `);
    const tuitionFee = ((tuitionFeeRows as any).rows || tuitionFeeRows)[0];

    let tuitionMap = new Map<string, number>();
    if (tuitionFee) {
      const tuitionAmts = await this.getTuitionClassAmounts(tuitionFee.id, term, session);
      tuitionMap = new Map(tuitionAmts.map(ta => [ta.classId, Number(ta.amount)]));
    }

    const allStudents = ((studentsRows as any).rows || studentsRows) as any[];
    const feesMap = new Map(((feesRows as any).rows || feesRows).map((r: any) => [r.studentId, Number(r.totalAssigned)]));
    const paymentsMap = new Map(((paymentsRows as any).rows || paymentsRows).map((r: any) => [r.studentId, Number(r.totalPaid)]));

    const classGroupMap = new Map<string, { classId: string; className: string; students: any[] }>();

    for (const s of allStudents) {
      if (!classGroupMap.has(s.classId)) {
        classGroupMap.set(s.classId, { classId: s.classId, className: s.className || s.classId, students: [] });
      }
      const sfAssigned = feesMap.get(s.id) || 0;
      const tuitionAssigned = tuitionMap.get(s.classId) || 0;
      const totalAssigned = sfAssigned + tuitionAssigned;
      const totalPaid = paymentsMap.get(s.id) || 0;
      const balance = totalAssigned - totalPaid;
      let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
      if (totalAssigned > 0 && balance <= 0) status = 'paid';
      else if (totalPaid > 0) status = 'partial';

      classGroupMap.get(s.classId)!.students.push({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        sowaId: s.sowaId,
        totalAssigned,
        totalPaid,
        balance: Math.max(0, balance),
        status,
      });
    }

    const classesArr = Array.from(classGroupMap.values()).map(cls => ({
      ...cls,
      classTotals: {
        totalAssigned: cls.students.reduce((sum: number, st: any) => sum + st.totalAssigned, 0),
        totalPaid: cls.students.reduce((sum: number, st: any) => sum + st.totalPaid, 0),
        balance: cls.students.reduce((sum: number, st: any) => sum + st.balance, 0),
      },
    }));

    const grandTotal = {
      totalAssigned: classesArr.reduce((sum, c) => sum + c.classTotals.totalAssigned, 0),
      totalPaid: classesArr.reduce((sum, c) => sum + c.classTotals.totalPaid, 0),
      balance: classesArr.reduce((sum, c) => sum + c.classTotals.balance, 0),
    };

    return { classes: classesArr, grandTotal };
  }

  async getFinancialSummary(schoolId?: string, term?: string, session?: string): Promise<{
    totalFees: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    totalRevenue: number;
    totalOutstanding: number;
    collectionRate: number;
    studentsOwing: number;
  }> {
    const revenueConditions: any[] = [eq(feePaymentRecords.status, 'confirmed')];
    if (schoolId) revenueConditions.push(eq(feePaymentRecords.schoolId, schoolId));
    if (term) revenueConditions.push(eq(feePaymentRecords.term, term));
    if (session) revenueConditions.push(eq(feePaymentRecords.session, session));

    const [revenueRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${feePaymentRecords.amount}), 0)` })
      .from(feePaymentRecords)
      .where(and(...revenueConditions));
    const totalRevenue = Number(revenueRow?.total || 0);

    const activeStudentsRows = await db.execute(sql`
      SELECT s.id, s.class_id AS "classId"
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.is_active = true
        ${schoolId ? sql`AND u.school_id = ${schoolId}` : sql``}
    `);
    const allActiveStudents = ((activeStudentsRows as any).rows || activeStudentsRows) as { id: string; classId: string }[];

    const tuitionFeeConditions: any[] = [eq(feeTypes.isTuition, true), eq(feeTypes.isActive, true)];
    if (schoolId) tuitionFeeConditions.push(eq(feeTypes.schoolId, schoolId));
    const [tuitionFeeType] = await db.select().from(feeTypes).where(and(...tuitionFeeConditions)).limit(1);

    let totalTuitionOwed = 0;
    let tuitionPaid = 0;
    let studentsOwing = 0;

    if (tuitionFeeType) {
      let tuitionAmounts = await this.getTuitionClassAmounts(tuitionFeeType.id, term, session);
      if (tuitionAmounts.length === 0 && (term || session)) {
        tuitionAmounts = await this.getTuitionClassAmounts(tuitionFeeType.id);
      }
      const classAmountMap = new Map(tuitionAmounts.map(ta => [ta.classId, Number(ta.amount)]));

      for (const student of allActiveStudents) {
        const classAmount = student.classId ? classAmountMap.get(student.classId) : undefined;
        if (classAmount) {
          totalTuitionOwed += classAmount;
        }
      }

      const tuitionPaymentConditions: any[] = [
        eq(feePaymentRecords.status, 'confirmed'),
        eq(feePaymentRecords.purpose, tuitionFeeType.name),
      ];
      if (schoolId) tuitionPaymentConditions.push(eq(feePaymentRecords.schoolId, schoolId));
      if (term) tuitionPaymentConditions.push(eq(feePaymentRecords.term, term));
      if (session) tuitionPaymentConditions.push(eq(feePaymentRecords.session, session));

      const [tuitionPaidRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${feePaymentRecords.amount}), 0)` })
        .from(feePaymentRecords)
        .where(and(...tuitionPaymentConditions));
      tuitionPaid = Number(tuitionPaidRow?.total || 0);

      const paidTuitionStudentRows = await db
        .selectDistinct({ studentId: feePaymentRecords.studentId })
        .from(feePaymentRecords)
        .where(and(...tuitionPaymentConditions));
      const paidTuitionStudentIds = new Set(paidTuitionStudentRows.map(r => r.studentId));
      studentsOwing = allActiveStudents.filter(s => !paidTuitionStudentIds.has(s.id)).length;
    } else {
      studentsOwing = 0;
    }

    const totalOutstanding = Math.max(0, totalTuitionOwed - tuitionPaid);
    const collectionRate = totalTuitionOwed > 0 ? Math.round((tuitionPaid / totalTuitionOwed) * 100) : 0;

    return {
      totalFees: totalTuitionOwed,
      totalPaid: tuitionPaid,
      totalPending: 0,
      totalOverdue: 0,
      totalRevenue,
      totalOutstanding,
      collectionRate,
      studentsOwing,
    };
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existingSetting = await this.getSetting(key);
    
    if (existingSetting) {
      const [updatedSetting] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updatedSetting;
    } else {
      const [newSetting] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      return newSetting;
    }
  }

  // Academic Sessions and Terms Management
  async createAcademicSession(sessionData: InsertAcademicSession): Promise<AcademicSession> {
    const [session] = await db
      .insert(academicSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async getAcademicSessions(): Promise<AcademicSession[]> {
    return await db.select().from(academicSessions).orderBy(desc(academicSessions.createdAt));
  }

  async getActiveAcademicSession(): Promise<AcademicSession | undefined> {
    const [session] = await db.select().from(academicSessions).where(eq(academicSessions.isActive, true));
    return session;
  }

  async setActiveAcademicSession(sessionId: string): Promise<AcademicSession> {
    // Deactivate all sessions first
    await db.update(academicSessions).set({ isActive: false });
    
    // Activate the selected session
    const [session] = await db
      .update(academicSessions)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(academicSessions.id, sessionId))
      .returning();
    return session;
  }

  async createAcademicTerm(termData: InsertAcademicTerm): Promise<AcademicTerm> {
    const [term] = await db
      .insert(academicTerms)
      .values(termData)
      .returning();
    return term;
  }

  async getAcademicTerms(sessionId?: string): Promise<AcademicTerm[]> {
    let query = db.select().from(academicTerms);
    
    if (sessionId) {
      query = query.where(eq(academicTerms.sessionId, sessionId));
    }
    
    return await query.orderBy(asc(academicTerms.termName));
  }

  async getActiveTerm(): Promise<AcademicTerm | undefined> {
    const [term] = await db.select().from(academicTerms).where(eq(academicTerms.isActive, true));
    return term;
  }

  async setActiveTerm(termId: string): Promise<AcademicTerm> {
    // Deactivate all terms first
    await db.update(academicTerms).set({ isActive: false });
    
    // Activate the selected term
    const [term] = await db
      .update(academicTerms)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(academicTerms.id, termId))
      .returning();
    return term;
  }

  // Student Promotion System
  async promoteStudentsToNextClass(currentClassId: string, nextClassId: string, studentIds: string[]): Promise<void> {
    await db
      .update(students)
      .set({ 
        classId: nextClassId,
        updatedAt: new Date()
      })
      .where(inArray(students.id, studentIds));
  }

  async markStudentsAsGraduated(studentIds: string[]): Promise<void> {
    await db
      .update(students)
      .set({ 
        status: 'graduated',
        updatedAt: new Date()
      })
      .where(inArray(students.id, studentIds));
  }

  // Enhanced student creation helper methods

  // Advanced term progression system
  async advanceAcademicTerm(): Promise<{ newTerm: string; newSession: string }> {
    try {
      // Get current active term and session
      const currentAcademicInfo = await this.getCurrentAcademicInfo();
      const currentTerm = currentAcademicInfo.currentTerm;
      const currentSession = currentAcademicInfo.currentSession;

      if (!currentTerm || !currentSession) {
        throw new Error("No active term or session found");
      }

      let newTerm: string;
      let newSession: string;

      // Determine next term progression
      if (currentTerm === "First Term") {
        newTerm = "Second Term";
        newSession = currentSession;
      } else if (currentTerm === "Second Term") {
        newTerm = "Third Term";
        newSession = currentSession;
      } else if (currentTerm === "Third Term") {
        // Advance to next session
        newTerm = "First Term";
        const [startYear, endYear] = currentSession.split('/');
        const nextStartYear = parseInt(startYear) + 1;
        const nextEndYear = parseInt(endYear) + 1;
        newSession = `${nextStartYear}/${nextEndYear}`;
      } else {
        throw new Error("Invalid current term");
      }

      // Check if new session needs to be created
      if (newSession !== currentSession) {
        const existingSession = await db
          .select()
          .from(academicSessions)
          .where(eq(academicSessions.sessionYear, newSession))
          .limit(1);

        if (existingSession.length === 0) {
          // Create new session
          await db.insert(academicSessions).values({
            sessionYear: newSession,
            startDate: new Date(),
            endDate: new Date(new Date().getFullYear() + 1, 7, 31), // End of next August
            isActive: false
          });
        }
      }

      // Get the session ID
      const [session] = await db
        .select()
        .from(academicSessions)
        .where(eq(academicSessions.sessionYear, newSession));

      if (!session) {
        throw new Error("Failed to find or create session");
      }

      // Check if new term exists for this session
      const existingTerm = await db
        .select()
        .from(academicTerms)
        .where(
          and(
            eq(academicTerms.sessionId, session.id),
            eq(academicTerms.termName, newTerm)
          )
        )
        .limit(1);

      let termId: string;

      if (existingTerm.length === 0) {
        // Create new term
        const [newTermRecord] = await db.insert(academicTerms).values({
          sessionId: session.id,
          termName: newTerm,
          startDate: new Date(),
          endDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days later
          isActive: false
        }).returning();
        termId = newTermRecord.id;
      } else {
        termId = existingTerm[0].id;
      }

      // Deactivate all current terms and sessions (scoped by school if needed)
      await db.update(academicTerms).set({ isActive: false });
      await db.update(academicSessions).set({ isActive: false });

      // Activate new session and term
      await db
        .update(academicSessions)
        .set({ isActive: true })
        .where(eq(academicSessions.id, session.id));

      await db
        .update(academicTerms)
        .set({ isActive: true })
        .where(eq(academicTerms.id, termId));

      return { newTerm, newSession };
    } catch (error) {
      console.error("Error advancing academic term:", error);
      throw error;
    }
  }









  async initializeAcademicCalendar(): Promise<{ session: string; term: string }> {
    try {
      // Check if any active session/term exists
      const currentInfo = await this.getCurrentAcademicInfo();
      if (currentInfo.currentSession && currentInfo.currentTerm) {
        return {
          session: currentInfo.currentSession,
          term: currentInfo.currentTerm
        };
      }

      // Use transaction for safe initialization
      return await db.transaction(async (tx) => {
        // Create default session for current academic year
        const currentYear = new Date().getFullYear();
        const sessionYear = `${currentYear}/${currentYear + 1}`;

        // Upsert session - create if doesn't exist
        let session;
        const [existingSession] = await tx
          .select()
          .from(academicSessions)
          .where(eq(academicSessions.sessionYear, sessionYear))
          .limit(1);

        if (existingSession) {
          session = existingSession;
        } else {
          [session] = await tx
            .insert(academicSessions)
            .values({
              sessionYear,
              startDate: new Date(),
              endDate: new Date(currentYear + 1, 7, 31), // End of next August
              isActive: false
            })
            .returning();
        }

        // Check if First Term already exists for this session
        const [existingTerm] = await tx
          .select()
          .from(academicTerms)
          .where(
            and(
              eq(academicTerms.sessionId, session.id),
              eq(academicTerms.termName, "First Term")
            )
          )
          .limit(1);

        let term;
        if (existingTerm) {
          term = existingTerm;
        } else {
          // Create First Term for this session
          [term] = await tx
            .insert(academicTerms)
            .values({
              termName: "First Term",
              sessionId: session.id,
              startDate: new Date(),
              endDate: new Date(currentYear, 11, 15), // Mid December
              resumptionDate: new Date(currentYear, 8, 15), // Mid September
              isActive: false
            })
            .returning();
        }

        // Safely deactivate other sessions and terms, then activate the new ones
        await tx.update(academicSessions).set({ isActive: false }).where(ne(academicSessions.id, session.id));
        await tx.update(academicTerms).set({ isActive: false }).where(ne(academicTerms.id, term.id));
        
        await tx.update(academicSessions)
          .set({ isActive: true })
          .where(eq(academicSessions.id, session.id));
        
        await tx.update(academicTerms)
          .set({ isActive: true })
          .where(eq(academicTerms.id, term.id));

        return {
          session: sessionYear,
          term: "First Term"
        };
      });
    } catch (error) {
      console.error("Error initializing academic calendar:", error);
      throw error;
    }
  }

  async getCurrentAcademicInfo(schoolId?: string): Promise<{
    currentSession: string | null;
    currentTerm: string | null;
  }> {
    try {
      // If schoolId provided, use that school's own term/session
      if (schoolId) {
        const [school] = await db
          .select({ currentTerm: schools.currentTerm, currentSession: schools.currentSession })
          .from(schools)
          .where(eq(schools.id, schoolId));
        if (school?.currentTerm && school?.currentSession) {
          return { currentSession: school.currentSession, currentTerm: school.currentTerm };
        }
      }

      // Fall back to global active flags
      const [activeSession] = await db
        .select()
        .from(academicSessions)
        .where(eq(academicSessions.isActive, true));

      const [activeTerm] = await db
        .select({
          termName: academicTerms.termName,
          sessionYear: academicSessions.sessionYear
        })
        .from(academicTerms)
        .leftJoin(academicSessions, eq(academicTerms.sessionId, academicSessions.id))
        .where(eq(academicTerms.isActive, true));

      return {
        currentSession: activeSession?.sessionYear || activeTerm?.sessionYear || null,
        currentTerm: activeTerm?.termName || null
      };
    } catch (error) {
      console.error("Error getting current academic info:", error);
      return { currentSession: null, currentTerm: null };
    }
  }

  async advanceAcademicTermForSchool(schoolId: string): Promise<{ newTerm: string; newSession: string }> {
    try {
      const currentInfo = await this.getCurrentAcademicInfo(schoolId);
      const currentTerm = currentInfo.currentTerm;
      const currentSession = currentInfo.currentSession;

      if (!currentTerm || !currentSession) {
        throw new Error("No active term or session found for this school");
      }

      let newTerm: string;
      let newSession: string;

      if (currentTerm === "First Term") {
        newTerm = "Second Term";
        newSession = currentSession;
      } else if (currentTerm === "Second Term") {
        newTerm = "Third Term";
        newSession = currentSession;
      } else if (currentTerm === "Third Term") {
        newTerm = "First Term";
        const [startYear, endYear] = currentSession.split('/');
        newSession = `${parseInt(startYear) + 1}/${parseInt(endYear) + 1}`;
      } else {
        throw new Error("Invalid current term");
      }

      // Ensure the session record exists in academic_sessions
      const existingSession = await db
        .select()
        .from(academicSessions)
        .where(eq(academicSessions.sessionYear, newSession))
        .limit(1);

      if (existingSession.length === 0) {
        await db.insert(academicSessions).values({
          sessionYear: newSession,
          startDate: new Date(),
          endDate: new Date(new Date().getFullYear() + 1, 7, 31),
          isActive: false
        });
      }

      // Ensure the term record exists in academic_terms for that session
      const [session] = await db
        .select()
        .from(academicSessions)
        .where(eq(academicSessions.sessionYear, newSession));

      const existingTerm = await db
        .select()
        .from(academicTerms)
        .where(and(eq(academicTerms.sessionId, session.id), eq(academicTerms.termName, newTerm)))
        .limit(1);

      if (existingTerm.length === 0) {
        await db.insert(academicTerms).values({
          sessionId: session.id,
          termName: newTerm,
          startDate: new Date(),
          endDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000),
          isActive: false
        });
      }

      // Update ONLY this school's current term/session
      await db
        .update(schools)
        .set({ currentTerm: newTerm, currentSession: newSession, updatedAt: new Date() })
        .where(eq(schools.id, schoolId));

      return { newTerm, newSession };
    } catch (error) {
      console.error("Error advancing academic term for school:", error);
      throw error;
    }
  }

  // Attendance tracking methods
  async getStudentAttendance(studentId: string, term?: string, session?: string): Promise<Attendance[]> {
    let query = db.select().from(attendance).where(eq(attendance.studentId, studentId));
    
    if (term && session) {
      query = query.where(and(eq(attendance.term, term), eq(attendance.session, session))) as any;
    } else if (term) {
      query = query.where(eq(attendance.term, term)) as any;
    } else if (session) {
      query = query.where(eq(attendance.session, session)) as any;
    }
    
    return await query;
  }

  async getClassAttendance(classId: string, term: string, session: string): Promise<(Attendance & { student: StudentWithDetails })[]> {
    const result = await db.select({
      id: attendance.id,
      studentId: attendance.studentId,
      classId: attendance.classId,
      term: attendance.term,
      session: attendance.session,
      totalDays: attendance.totalDays,
      presentDays: attendance.presentDays,
      absentDays: attendance.absentDays,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
      student: {
        id: students.id,
        userId: students.userId,
        classId: students.classId,
        studentId: students.studentId,
        dateOfBirth: students.dateOfBirth,
        parentWhatsapp: students.parentWhatsapp,
        address: students.address,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          password: users.password,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          schoolId: users.schoolId,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        class: {
          id: classes.id,
          name: classes.name,
          description: classes.description,
          schoolId: classes.schoolId,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt,
        }
      }
    })
    .from(attendance)
    .innerJoin(students, eq(attendance.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(and(
      eq(attendance.classId, classId),
      eq(attendance.term, term),
      eq(attendance.session, session)
    ));
    
    return result as (Attendance & { student: StudentWithDetails })[];
  }

  async upsertAttendance(attendanceData: InsertAttendance): Promise<Attendance> {
    const existing = await db.select().from(attendance)
      .where(and(
        eq(attendance.studentId, attendanceData.studentId),
        eq(attendance.term, attendanceData.term),
        eq(attendance.session, attendanceData.session)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(attendance)
        .set({
          totalDays: attendanceData.totalDays,
          presentDays: attendanceData.presentDays,
          absentDays: attendanceData.absentDays,
          updatedAt: new Date()
        })
        .where(eq(attendance.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(attendance).values(attendanceData).returning();
      return created;
    }
  }

  async getAttendanceByStudent(studentId: string, term: string, session: string): Promise<Attendance | undefined> {
    const result = await db.select().from(attendance)
      .where(and(
        eq(attendance.studentId, studentId),
        eq(attendance.term, term),
        eq(attendance.session, session)
      ))
      .limit(1);
    return result[0];
  }

  // Report Card operations
  async getAllGeneratedReportCards(schoolId?: string): Promise<GeneratedReportCard[]> {
    if (schoolId) {
      const result = await db
        .select({ report: generatedReportCards })
        .from(generatedReportCards)
        .innerJoin(classes, eq(generatedReportCards.classId, classes.id))
        .where(eq(classes.schoolId, schoolId))
        .orderBy(desc(generatedReportCards.generatedAt));
      return result.map(r => r.report);
    }
    return await db.select().from(generatedReportCards).orderBy(desc(generatedReportCards.generatedAt));
  }

  async getGeneratedReportCardsByStudent(studentId: string): Promise<GeneratedReportCard[]> {
    return await db.select()
      .from(generatedReportCards)
      .where(eq(generatedReportCards.studentId, studentId))
      .orderBy(desc(generatedReportCards.generatedAt));
  }

  async getGeneratedReportCardsByClass(classId: string): Promise<GeneratedReportCard[]> {
    return await db.select()
      .from(generatedReportCards)
      .where(eq(generatedReportCards.classId, classId))
      .orderBy(desc(generatedReportCards.generatedAt));
  }

  async createGeneratedReportCard(reportCardData: InsertGeneratedReportCard): Promise<GeneratedReportCard> {
    const [newReportCard] = await db
      .insert(generatedReportCards)
      .values(reportCardData)
      .returning();
    return newReportCard;
  }

  async deleteGeneratedReportCard(reportCardId: string): Promise<void> {
    await db.delete(generatedReportCards).where(eq(generatedReportCards.id, reportCardId));
  }

  async validateReportCardData(studentId: string, classId: string, term: string, session: string): Promise<{ hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }> {
    // Get class information to determine if it's SS2 or SS3
    const [classInfo] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));

    // Get all subjects assigned to the class
    const classSubjectsQuery = await db
      .select({ subject: subjects })
      .from(classSubjects)
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(eq(classSubjects.classId, classId));

    const assignedSubjects = classSubjectsQuery.map(cs => cs.subject).filter(Boolean) as Subject[];

    // Get all assessments for this student in this term/session
    const studentAssessments = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.studentId, studentId),
          eq(assessments.classId, classId),
          eq(assessments.term, term),
          eq(assessments.session, session)
        )
      );

    // Check which subjects have complete scores (first CA, second CA, and exam)
    const subjectsWithCompleteScores = studentAssessments.filter(
      assessment => 
        assessment.firstCA !== null && 
        assessment.secondCA !== null && 
        assessment.exam !== null
    );

    const missingSubjects = assignedSubjects
      .filter(subject => !subjectsWithCompleteScores.find(assessment => assessment.subjectId === subject.id))
      .map(subject => subject.name);

    // Special validation logic for SS2 and SS3 - they only need 9 subjects
    const isSSClass = classInfo && (classInfo.name.includes('S.S.S 2') || classInfo.name.includes('S.S.S 3'));
    const minimumRequiredSubjects = isSSClass ? 9 : assignedSubjects.length;
    const completedSubjectsCount = subjectsWithCompleteScores.length;

    let hasAllScores: boolean;
    let adjustedMissingSubjects = missingSubjects;
    
    if (isSSClass) {
      // For SS2/SS3: Pass if they have at least 9 subjects with complete scores
      hasAllScores = completedSubjectsCount >= minimumRequiredSubjects;
      // If they have 9+ subjects, ignore missing subjects for validation
      if (hasAllScores) {
        adjustedMissingSubjects = [];
      }
    } else {
      // For other classes: Must have all assigned subjects
      hasAllScores = missingSubjects.length === 0 && assignedSubjects.length > 0;
    }

    // Check attendance data
    const attendanceRecord = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.studentId, studentId),
          eq(attendance.classId, classId),
          eq(attendance.term, term),
          eq(attendance.session, session)
        )
      )
      .limit(1);

    const hasAttendance = attendanceRecord.length > 0 && attendanceRecord[0].totalDays > 0;

    return {
      hasAllScores,
      hasAttendance,
      missingSubjects: adjustedMissingSubjects
    };
  }

  async validateReportCardDataBulk(classId: string, term: string, session: string): Promise<{
    results: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
    summary: { total: number; ready: number; partial: number; incomplete: number };
  }> {
    const [classInfo] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));

    const classSubjectsQuery = await db
      .select({ subject: subjects })
      .from(classSubjects)
      .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(eq(classSubjects.classId, classId));

    const assignedSubjects = classSubjectsQuery.map(cs => cs.subject).filter(Boolean) as Subject[];

    const classStudents = await db
      .select({ id: students.id, firstName: users.firstName, lastName: users.lastName })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(eq(students.classId, classId), eq(users.isActive, true)));

    if (classStudents.length === 0) {
      return { results: {}, summary: { total: 0, ready: 0, partial: 0, incomplete: 0 } };
    }

    const studentIds = classStudents.map(s => s.id);

    const allAssessments = await db
      .select()
      .from(assessments)
      .where(
        and(
          inArray(assessments.studentId, studentIds),
          eq(assessments.classId, classId),
          eq(assessments.term, term),
          eq(assessments.session, session)
        )
      );

    const allAttendance = await db
      .select()
      .from(attendance)
      .where(
        and(
          inArray(attendance.studentId, studentIds),
          eq(attendance.classId, classId),
          eq(attendance.term, term),
          eq(attendance.session, session)
        )
      );

    const isSSClass = classInfo && (classInfo.name.includes('S.S.S 2') || classInfo.name.includes('S.S.S 3'));
    const minimumRequiredSubjects = isSSClass ? 9 : assignedSubjects.length;

    const results: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }> = {};
    let ready = 0, partial = 0, incomplete = 0;

    for (const student of classStudents) {
      const studentAssessments = allAssessments.filter(a => a.studentId === student.id);
      const completeAssessments = studentAssessments.filter(
        a => a.firstCA !== null && a.secondCA !== null && a.exam !== null
      );

      const missingSubjects = assignedSubjects
        .filter(subject => !completeAssessments.find(a => a.subjectId === subject.id))
        .map(subject => subject.name);

      let hasAllScores: boolean;
      let adjustedMissing = missingSubjects;

      if (isSSClass) {
        hasAllScores = completeAssessments.length >= minimumRequiredSubjects;
        if (hasAllScores) adjustedMissing = [];
      } else {
        hasAllScores = missingSubjects.length === 0 && assignedSubjects.length > 0;
      }

      const studentAttendance = allAttendance.find(a => a.studentId === student.id);
      const hasAttendance = !!studentAttendance && studentAttendance.totalDays > 0;

      results[student.id] = { hasAllScores, hasAttendance, missingSubjects: adjustedMissing };

      if (hasAllScores && hasAttendance) ready++;
      else if (hasAllScores || hasAttendance) partial++;
      else incomplete++;
    }

    return {
      results,
      summary: { total: classStudents.length, ready, partial, incomplete }
    };
  }

  async validateReportCardDataSchool(term: string, session: string, schoolId?: string): Promise<{
    classes: Record<string, {
      className: string;
      totalStudents: number;
      validatedStudents: number;
      issues: string[];
    }>;
    studentResults: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
    summary: { totalStudents: number; readyStudents: number };
  }> {
    let schoolClasses;
    if (schoolId) {
      schoolClasses = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
    } else {
      schoolClasses = await db.select().from(classes);
    }

    const classResults: Record<string, { className: string; totalStudents: number; validatedStudents: number; issues: string[] }> = {};
    const allStudentResults: Record<string, { hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }> = {};
    let totalStudents = 0;
    let readyStudents = 0;

    for (const cls of schoolClasses) {
      const bulkResult = await this.validateReportCardDataBulk(cls.id, term, session);

      const issues: string[] = [];
      const classStudents = await db
        .select({ id: students.id, firstName: users.firstName, lastName: users.lastName })
        .from(students)
        .leftJoin(users, eq(students.userId, users.id))
        .where(and(eq(students.classId, cls.id), eq(users.isActive, true)));

      const studentNameMap = new Map(classStudents.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

      for (const [studentId, result] of Object.entries(bulkResult.results)) {
        allStudentResults[studentId] = result;
        if (!result.hasAllScores || !result.hasAttendance) {
          const name = studentNameMap.get(studentId) || studentId;
          const parts: string[] = [];
          if (!result.hasAllScores && result.missingSubjects.length > 0) {
            parts.push(`Missing subjects: ${result.missingSubjects.slice(0, 2).join(", ")}${result.missingSubjects.length > 2 ? ` +${result.missingSubjects.length - 2}` : ""}`);
          } else if (!result.hasAllScores) {
            parts.push("Missing scores");
          }
          if (!result.hasAttendance) parts.push("No attendance");
          issues.push(`${name}: ${parts.join(", ")}`);
        }
      }

      classResults[cls.id] = {
        className: cls.name,
        totalStudents: bulkResult.summary.total,
        validatedStudents: bulkResult.summary.ready,
        issues
      };

      totalStudents += bulkResult.summary.total;
      readyStudents += bulkResult.summary.ready;
    }

    return {
      classes: classResults,
      studentResults: allStudentResults,
      summary: { totalStudents, readyStudents }
    };
  }

  // Enhanced student creation helpers
  async getSchoolNumber(schoolId: string): Promise<string> {
    // Get school info and extract number from name or use a default pattern
    const school = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
    if (school.length > 0) {
      // Try to extract number from school name (e.g., "School 1" -> "1")
      const match = school[0].name.match(/(\d+)/);
      if (match) {
        return match[1];
      }
    }
    // Default to "1" if no number found
    return "1";
  }

  async getStudentCountForSchool(schoolId: string): Promise<number> {
    // Count existing students in the school (through classes)
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(classes.schoolId, schoolId));
    
    return result[0]?.count || 0;
  }

  async getClassById(classId: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
    return result[0];
  }

  async updateSchool(schoolId: string, data: Partial<School>): Promise<School> {
    const [updated] = await db
      .update(schools)
      .set(data)
      .where(eq(schools.id, schoolId))
      .returning();
    
    if (!updated) {
      throw new Error('School not found');
    }
    
    return updated;
  }

  async updateUserProfile(userId: string, data: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) {
      throw new Error('User not found');
    }
    
    return updated;
  }

  // New methods for teacher grading interface
  async getAssessmentsByClassTermSession(classId: string, term: string, session: string): Promise<(Assessment & { subject: Subject })[]> {
    const result = await db
      .select({
        id: assessments.id,
        studentId: assessments.studentId,
        subjectId: assessments.subjectId,
        classId: assessments.classId,
        term: assessments.term,
        session: assessments.session,
        firstCA: assessments.firstCA,
        secondCA: assessments.secondCA,
        exam: assessments.exam,
        total: assessments.total,
        grade: assessments.grade,
        remark: assessments.remark,
        createdAt: assessments.createdAt,
        updatedAt: assessments.updatedAt,
        subject: {
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          description: subjects.description,
          createdAt: subjects.createdAt,
          updatedAt: subjects.updatedAt
        }
      })
      .from(assessments)
      .leftJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(
        and(
          eq(assessments.classId, classId),
          eq(assessments.term, term),
          eq(assessments.session, session)
        )
      );

    return result.map(row => ({
      ...row,
      subject: row.subject as Subject
    })) as (Assessment & { subject: Subject })[];
  }

  async createOrUpdateNonAcademicRating(ratingData: InsertNonAcademicRating): Promise<NonAcademicRating> {
    // Check if rating already exists
    const existing = await db
      .select()
      .from(nonAcademicRatings)
      .where(
        and(
          eq(nonAcademicRatings.studentId, ratingData.studentId),
          eq(nonAcademicRatings.classId, ratingData.classId),
          eq(nonAcademicRatings.term, ratingData.term),
          eq(nonAcademicRatings.session, ratingData.session)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing rating
      const [updated] = await db
        .update(nonAcademicRatings)
        .set({
          ...ratingData,
          updatedAt: new Date()
        })
        .where(eq(nonAcademicRatings.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // Create new rating
      const [created] = await db
        .insert(nonAcademicRatings)
        .values(ratingData)
        .returning();
      return created;
    }
  }

  async getNonAcademicRatingsByClass(classId: string, term: string, session: string): Promise<NonAcademicRating[]> {
    return await db
      .select()
      .from(nonAcademicRatings)
      .where(
        and(
          eq(nonAcademicRatings.classId, classId),
          eq(nonAcademicRatings.term, term),
          eq(nonAcademicRatings.session, session)
        )
      );
  }

  async getNonAcademicRatingByStudent(studentId: string, classId: string, term: string, session: string): Promise<NonAcademicRating | undefined> {
    const [rating] = await db
      .select()
      .from(nonAcademicRatings)
      .where(
        and(
          eq(nonAcademicRatings.studentId, studentId),
          eq(nonAcademicRatings.classId, classId),
          eq(nonAcademicRatings.term, term),
          eq(nonAcademicRatings.session, session)
        )
      );
    return rating;
  }

  async createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db
      .insert(calendarEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async getCalendarEvents(schoolId?: string): Promise<CalendarEvent[]> {
    let query = db.select().from(calendarEvents);
    
    if (schoolId) {
      query = query.where(
        and(
          eq(calendarEvents.schoolId, schoolId),
          eq(calendarEvents.isSystemWide, false)
        )
      ) as any;
    } else {
      query = query.where(eq(calendarEvents.isSystemWide, true)) as any;
    }
    
    return await query.orderBy(asc(calendarEvents.eventDate));
  }

  // News operations
  async createNews(newsData: InsertNews): Promise<News> {
    const [newsItem] = await db
      .insert(news)
      .values(newsData)
      .returning();
    return newsItem;
  }

  async getAllNews(): Promise<(News & { author: Omit<User, 'password' | 'passwordUpdatedAt'> })[]> {
    const result = await db
      .select({
        id: news.id,
        title: news.title,
        content: news.content,
        imageUrl: news.imageUrl,
        tag: news.tag,
        publishedAt: news.publishedAt,
        authorId: news.authorId,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          schoolId: users.schoolId,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .orderBy(desc(news.publishedAt));

    return result.map(row => ({
      ...row,
      author: row.author as Omit<User, 'password' | 'passwordUpdatedAt'>
    }));
  }

  async getAllPublishedNews(): Promise<(News & { author: Omit<User, 'password' | 'passwordUpdatedAt'> })[]> {
    const result = await db
      .select({
        id: news.id,
        title: news.title,
        content: news.content,
        imageUrl: news.imageUrl,
        tag: news.tag,
        publishedAt: news.publishedAt,
        authorId: news.authorId,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          schoolId: users.schoolId,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(isNotNull(news.publishedAt))
      .orderBy(desc(news.publishedAt));

    return result.map(row => ({
      ...row,
      author: row.author as Omit<User, 'password' | 'passwordUpdatedAt'>
    }));
  }

  async deleteNews(newsId: string): Promise<void> {
    await db.delete(news).where(eq(news.id, newsId));
  }

  // Notification operations
  async createNotificationForAllStudents(message: string, schoolId?: string): Promise<Notification[]> {
    // Get all students, optionally filtered by school
    let studentQuery = db
      .select({
        userId: students.userId,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id));

    if (schoolId) {
      studentQuery = studentQuery
        .leftJoin(classes, eq(students.classId, classes.id))
        .where(eq(classes.schoolId, schoolId)) as any;
    }

    const studentsData = await studentQuery;

    // Create notification for each student
    const notificationPromises = studentsData.map(student =>
      db.insert(notifications).values({
        userId: student.userId,
        message,
      }).returning()
    );

    const results = await Promise.all(notificationPromises);
    return results.map(([notification]) => notification);
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );

    return result[0]?.count || 0;
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    return notification;
  }

  // Published Scores operations
  async publishScores(classId: string, term: string, session: string, publishedBy: string, nextTermResumes: Date): Promise<void> {
    // Check if already published
    const existing = await db
      .select()
      .from(publishedScores)
      .where(
        and(
          eq(publishedScores.classId, classId),
          eq(publishedScores.term, term),
          eq(publishedScores.session, session)
        )
      );

    if (existing.length > 0) {
      // Already published, update the publishedAt time and nextTermResumes
      await db
        .update(publishedScores)
        .set({ publishedAt: new Date(), publishedBy, nextTermResumes })
        .where(
          and(
            eq(publishedScores.classId, classId),
            eq(publishedScores.term, term),
            eq(publishedScores.session, session)
          )
        );
    } else {
      // Not yet published, insert new record
      await db.insert(publishedScores).values({
        classId,
        term,
        session,
        publishedBy,
        nextTermResumes,
      });
    }
  }

  async unpublishScores(classId: string, term: string, session: string): Promise<void> {
    await db
      .delete(publishedScores)
      .where(
        and(
          eq(publishedScores.classId, classId),
          eq(publishedScores.term, term),
          eq(publishedScores.session, session)
        )
      );
  }

  async checkIfScoresPublished(classId: string, term: string, session: string): Promise<boolean> {
    const result = await db
      .select()
      .from(publishedScores)
      .where(
        and(
          eq(publishedScores.classId, classId),
          eq(publishedScores.term, term),
          eq(publishedScores.session, session)
        )
      );

    return result.length > 0;
  }

  async getPublishedScoreInfo(classId: string, term: string, session: string): Promise<PublishedScore | undefined> {
    const result = await db
      .select()
      .from(publishedScores)
      .where(
        and(
          eq(publishedScores.classId, classId),
          eq(publishedScores.term, term),
          eq(publishedScores.session, session)
        )
      );

    return result[0];
  }

  async getPublishedScoresByClass(classId: string): Promise<any[]> {
    return await db
      .select()
      .from(publishedScores)
      .where(eq(publishedScores.classId, classId))
      .orderBy(desc(publishedScores.publishedAt));
  }

  // Fee Payment Records (Payment Tracking & Reconciliation)
  async recordFeePayment(data: InsertFeePaymentRecord): Promise<FeePaymentRecord> {
    console.log('[recordFeePayment] Recording new payment:', data);
    const [record] = await db
      .insert(feePaymentRecords)
      .values({
        ...data,
        status: 'recorded',
      })
      .returning();
    
    console.log('[recordFeePayment] Created payment record:', record.id);
    return record;
  }

  async createFeePaymentWithSplits(
    record: Omit<InsertFeePaymentRecord, 'studentId'>,
    splits: Array<{ studentId: string; amount: number }>
  ): Promise<FeePaymentRecord> {
    console.log('[createFeePaymentWithSplits] Recording multi-student payment with', splits.length, 'splits');
    const insertData: InsertFeePaymentRecord = {
      ...record,
      studentId: undefined,
      status: 'recorded',
    };

    const paymentRecord = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(feePaymentRecords)
        .values(insertData)
        .returning();

      await tx.insert(feePaymentStudentSplits).values(
        splits.map(s => ({
          paymentRecordId: created.id,
          studentId: s.studentId,
          amount: s.amount.toString(),
        }))
      );

      return created;
    });

    console.log('[createFeePaymentWithSplits] Created payment record:', paymentRecord.id, 'with splits for', splits.length, 'students');
    return paymentRecord;
  }

  async getSplitsForPaymentRecord(paymentRecordId: string): Promise<any[]> {
    const rows = await db
      .select({
        split: feePaymentStudentSplits,
        student: students,
        user: users,
        class: classes,
      })
      .from(feePaymentStudentSplits)
      .leftJoin(students, eq(feePaymentStudentSplits.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(feePaymentStudentSplits.paymentRecordId, paymentRecordId));

    return rows.map((r) => ({
      ...r.split,
      student: r.student
        ? {
            ...r.student,
            user: r.user ?? undefined,
            class: r.class ?? undefined,
          }
        : null,
    }));
  }

  async getFeePaymentRecords(filters: { 
    schoolId?: string; 
    studentId?: string; 
    status?: string; 
    startDate?: Date; 
    endDate?: Date;
    term?: string;
    session?: string;
  }): Promise<FeePaymentRecordWithDetails[]> {
    console.log('[getFeePaymentRecords] Fetching with filters:', filters);
    
    const conditions: any[] = [];
    
    if (filters.schoolId) {
      conditions.push(eq(feePaymentRecords.schoolId, filters.schoolId));
    }
    if (filters.studentId) {
      conditions.push(eq(feePaymentRecords.studentId, filters.studentId));
    }
    if (filters.status) {
      conditions.push(eq(feePaymentRecords.status, filters.status));
    }
    if (filters.startDate) {
      conditions.push(sql`${feePaymentRecords.paymentDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${feePaymentRecords.paymentDate} <= ${filters.endDate}`);
    }
    if (filters.term) {
      conditions.push(eq(feePaymentRecords.term, filters.term));
    }
    if (filters.session) {
      conditions.push(eq(feePaymentRecords.session, filters.session));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const recorderUsers = alias(users, 'recorder_users');

    const records = await db
      .select({
        record: feePaymentRecords,
        student: students,
        user: users,
        class: classes,
        recordedByUser: {
          id: recorderUsers.id,
          firstName: recorderUsers.firstName,
          lastName: recorderUsers.lastName,
          email: recorderUsers.email,
        },
      })
      .from(feePaymentRecords)
      .leftJoin(students, eq(feePaymentRecords.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .leftJoin(recorderUsers, eq(feePaymentRecords.recordedBy, recorderUsers.id))
      .where(whereClause)
      .orderBy(desc(feePaymentRecords.createdAt));

    const result: FeePaymentRecordWithDetails[] = records.map(row => ({
      ...row.record,
      student: row.student ? {
        ...row.student,
        user: row.user!,
        class: row.class!,
      } : null,
      recordedByUser: row.recordedByUser as User | undefined,
    }));

    // Enrich multi-student records with splitCount
    const multiIds = result.filter(r => !r.student).map(r => r.id);
    if (multiIds.length > 0) {
      const splitCountRows = await db
        .select({
          id: feePaymentStudentSplits.paymentRecordId,
          cnt: sql<number>`COUNT(*)::int`,
        })
        .from(feePaymentStudentSplits)
        .where(inArray(feePaymentStudentSplits.paymentRecordId, multiIds))
        .groupBy(feePaymentStudentSplits.paymentRecordId);
      const splitCountMap = new Map(splitCountRows.map(r => [r.id, Number(r.cnt)]));
      result.forEach(r => {
        if (!r.student) {
          r.splitCount = splitCountMap.get(r.id) ?? 0;
        }
      });
    }

    console.log('[getFeePaymentRecords] Found', result.length, 'records');
    return result;
  }

  async getFeePaymentRecordById(id: string): Promise<FeePaymentRecordWithDetails | undefined> {
    console.log('[getFeePaymentRecordById] Fetching record:', id);
    
    const [row] = await db
      .select({
        record: feePaymentRecords,
        student: students,
        user: users,
        class: classes,
      })
      .from(feePaymentRecords)
      .leftJoin(students, eq(feePaymentRecords.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(feePaymentRecords.id, id));

    if (!row || !row.record) {
      console.log('[getFeePaymentRecordById] Record not found');
      return undefined;
    }

    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentRecordId, id));

    const result: FeePaymentRecordWithDetails = {
      ...row.record,
      student: row.student ? {
        ...row.student,
        user: row.user!,
        class: row.class!,
      } : null,
      allocations,
    };

    console.log('[getFeePaymentRecordById] Found record:', id);
    return result;
  }

  async confirmFeePayment(paymentId: string, bankTransactionId: string, confirmedBy: string): Promise<FeePaymentRecord> {
    console.log('[confirmFeePayment] Confirming payment:', paymentId);
    
    const [record] = await db
      .update(feePaymentRecords)
      .set({
        status: 'confirmed',
        confirmedBy,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feePaymentRecords.id, paymentId))
      .returning();

    if (!record) {
      throw new Error('Payment record not found');
    }

    console.log('[confirmFeePayment] Payment confirmed:', paymentId);
    return record;
  }

  async reverseFeePayment(paymentId: string, reversedBy: string, reason: string): Promise<FeePaymentRecord> {
    console.log('[reverseFeePayment] Reversing payment:', paymentId, 'Reason:', reason);
    
    const [record] = await db
      .update(feePaymentRecords)
      .set({
        status: 'reversed',
        reversedBy,
        reversedAt: new Date(),
        reversalReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(feePaymentRecords.id, paymentId))
      .returning();

    if (!record) {
      throw new Error('Payment record not found');
    }

    console.log('[reverseFeePayment] Payment reversed:', paymentId);
    return record;
  }

  async createMultiStudentAllocation(bankTransactionId: string, allocations: Array<{ studentId: string; amount: number; term?: string; session?: string; notes?: string; }>, allocatedBy: string): Promise<{ paymentRecords: FeePaymentRecord[]; allocations: any[] }> {
    console.log('[createMultiStudentAllocation] Creating allocations for bank transaction:', bankTransactionId);
    
    const createdPaymentRecords: FeePaymentRecord[] = [];
    const createdAllocations: any[] = [];

    try {
      // Create a fee_payment_record for each student
      for (const allocation of allocations) {
        console.log('[createMultiStudentAllocation] Processing allocation for student:', allocation.studentId, 'Amount:', allocation.amount);
        
        const [paymentRecord] = await db
          .insert(feePaymentRecords)
          .values({
            studentId: allocation.studentId,
            amount: allocation.amount.toString(),
            paymentMethod: 'bank_transfer',
            paymentDate: new Date(),
            term: allocation.term,
            session: allocation.session,
            status: 'confirmed',
            notes: allocation.notes,
            recordedBy: allocatedBy,
            confirmedBy: allocatedBy,
            confirmedAt: new Date(),
          })
          .returning();

        if (!paymentRecord) {
          throw new Error(`Failed to create payment record for student ${allocation.studentId}`);
        }

        createdPaymentRecords.push(paymentRecord);

        // Create a payment_allocation linking the payment to the bank transaction
        const [allocationRecord] = await db
          .insert(paymentAllocations)
          .values({
            paymentRecordId: paymentRecord.id,
            bankTransactionId,
            allocatedAmount: allocation.amount.toString(),
            allocatedBy,
          })
          .returning();

        if (!allocationRecord) {
          throw new Error(`Failed to create payment allocation for student ${allocation.studentId}`);
        }

        createdAllocations.push(allocationRecord);
        console.log('[createMultiStudentAllocation] Allocation created for student:', allocation.studentId);
      }

      // Update the bank transaction status to 'matched'
      const [updatedTransaction] = await db
        .update(bankTransactions)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(bankTransactions.id, bankTransactionId))
        .returning();

      if (!updatedTransaction) {
        throw new Error('Bank transaction not found');
      }

      console.log('[createMultiStudentAllocation] Bank transaction status updated to matched:', bankTransactionId);
      
      return {
        paymentRecords: createdPaymentRecords,
        allocations: createdAllocations,
      };
    } catch (error) {
      console.error('[createMultiStudentAllocation] Error:', error);
      throw error;
    }
  }

  async createPaymentAuditLog(data: InsertPaymentAuditLog): Promise<PaymentAuditLog> {
    console.log('[createPaymentAuditLog] Creating audit log:', data.action, data.entityType);
    
    const [log] = await db
      .insert(paymentAuditLogs)
      .values(data)
      .returning();

    console.log('[createPaymentAuditLog] Audit log created:', log.id);
    return log;
  }

  async uploadBankStatement(data: { fileName: string; fileType: string; uploadedBy: string; schoolId?: string; dateRangeStart?: Date; dateRangeEnd?: Date; }): Promise<BankStatement> {
    console.log('[uploadBankStatement] Creating bank statement record:', data.fileName);
    
    const [statement] = await db
      .insert(bankStatements)
      .values({
        fileName: data.fileName,
        fileType: data.fileType,
        uploadedBy: data.uploadedBy,
        schoolId: data.schoolId,
        dateRangeStart: data.dateRangeStart,
        dateRangeEnd: data.dateRangeEnd,
        totalTransactions: 0,
        newTransactions: 0,
        duplicatesSkipped: 0,
      })
      .returning();

    console.log('[uploadBankStatement] Bank statement created:', statement.id);
    return statement;
  }

  async getBankStatements(schoolId?: string): Promise<BankStatement[]> {
    console.log('[getBankStatements] Fetching statements for school:', schoolId || 'all');
    
    const whereClause = schoolId ? eq(bankStatements.schoolId, schoolId) : undefined;
    
    const statements = await db
      .select()
      .from(bankStatements)
      .where(whereClause)
      .orderBy(desc(bankStatements.createdAt));

    console.log('[getBankStatements] Found', statements.length, 'statements');
    return statements;
  }

  async updateBankStatementCounts(id: string, totalTransactions: number, newTransactions: number, duplicatesSkipped: number): Promise<BankStatement> {
    console.log('[updateBankStatementCounts] Updating statement:', id);
    
    const [statement] = await db
      .update(bankStatements)
      .set({
        totalTransactions,
        newTransactions,
        duplicatesSkipped,
        processedAt: new Date(),
      })
      .where(eq(bankStatements.id, id))
      .returning();

    if (!statement) {
      throw new Error('Bank statement not found');
    }

    console.log('[updateBankStatementCounts] Statement updated:', id);
    return statement;
  }

  async createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction> {
    console.log('[createBankTransaction] Creating transaction with fingerprint:', data.fingerprint);
    
    const [transaction] = await db
      .insert(bankTransactions)
      .values(data)
      .returning();

    console.log('[createBankTransaction] Transaction created:', transaction.id);
    return transaction;
  }

  async getBankTransactions(filters: { schoolId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<BankTransaction[]> {
    console.log('[getBankTransactions] Fetching with filters:', filters);
    
    const conditions = [];
    if (filters.schoolId) {
      conditions.push(eq(bankTransactions.schoolId, filters.schoolId));
    }
    if (filters.status) {
      conditions.push(eq(bankTransactions.status, filters.status));
    }
    if (filters.startDate) {
      conditions.push(sql`${bankTransactions.transactionDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${bankTransactions.transactionDate} <= ${filters.endDate}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const transactions = await db
      .select()
      .from(bankTransactions)
      .where(whereClause)
      .orderBy(desc(bankTransactions.transactionDate));

    console.log('[getBankTransactions] Found', transactions.length, 'transactions');
    return transactions;
  }

  async getUnmatchedBankTransactions(schoolId?: string): Promise<BankTransaction[]> {
    console.log('[getUnmatchedBankTransactions] Fetching unmatched for school:', schoolId || 'all');
    
    const conditions = [eq(bankTransactions.status, 'unmatched')];
    if (schoolId) {
      conditions.push(eq(bankTransactions.schoolId, schoolId));
    }
    
    const transactions = await db
      .select()
      .from(bankTransactions)
      .where(and(...conditions))
      .orderBy(desc(bankTransactions.transactionDate));

    console.log('[getUnmatchedBankTransactions] Found', transactions.length, 'unmatched transactions');
    return transactions;
  }

  async updateBankTransactionStatus(id: string, status: string, matchConfidence?: number): Promise<BankTransaction> {
    console.log('[updateBankTransactionStatus] Updating transaction:', id, 'to status:', status);
    
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (matchConfidence !== undefined) {
      updateData.matchConfidence = matchConfidence;
    }
    
    const [transaction] = await db
      .update(bankTransactions)
      .set(updateData)
      .where(eq(bankTransactions.id, id))
      .returning();

    if (!transaction) {
      throw new Error('Bank transaction not found');
    }

    console.log('[updateBankTransactionStatus] Transaction updated:', id);
    return transaction;
  }

  async checkTransactionFingerprint(fingerprint: string): Promise<boolean> {
    console.log('[checkTransactionFingerprint] Checking fingerprint:', fingerprint.substring(0, 16) + '...');
    
    const [existing] = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(eq(bankTransactions.fingerprint, fingerprint))
      .limit(1);

    const exists = !!existing;
    console.log('[checkTransactionFingerprint] Fingerprint exists:', exists);
    return exists;
  }
}

export const storage = new DatabaseStorage();