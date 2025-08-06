import {
  schools,
  users,
  students,
  classes,
  subjects,
  classSubjects,
  assessments,
  reportCardTemplates,
  feeTypes,
  studentFees,
  payments,
  type School,
  type User,
  type Student,
  type Class,
  type Subject,
  type Assessment,
  type ReportCardTemplate,
  type FeeType,
  type StudentFee,
  type Payment,
  type InsertUser,
  type InsertStudent,
  type InsertClass,
  type InsertSubject,
  type InsertAssessment,
  type InsertReportCardTemplate,
  type InsertFeeType,
  type InsertStudentFee,
  type InsertPayment,
  type StudentWithDetails,
  type StudentFeeWithDetails,
  type PaymentWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Authentication
  authenticateUser(email: string, password: string): Promise<User | null>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<boolean>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  
  // School operations
  getAllSchools(): Promise<School[]>;
  getSchoolById(id: string): Promise<School | undefined>;
  
  // Admin operations
  getAllUsers(): Promise<(User & { school?: School })[]>;
  createUser(userData: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  updateSchoolLogo(schoolId: string, logoUrl: string): Promise<School>;
  createStudent(studentData: InsertStudent): Promise<Student>;
  createClass(classData: InsertClass): Promise<Class>;
  createSubject(subjectData: InsertSubject): Promise<Subject>;
  assignSubjectToClass(classId: string, subjectId: string): Promise<void>;
  removeSubjectFromClass(classId: string, subjectId: string): Promise<void>;
  
  // Data retrieval (school-aware)
  getAllClasses(schoolId?: string): Promise<(Class & { school: School })[]>;
  getAllSubjects(): Promise<Subject[]>;
  getStudentsByClass(classId: string): Promise<StudentWithDetails[]>;
  getStudentByUserId(userId: string): Promise<StudentWithDetails | undefined>;
  getAllStudentsWithDetails(schoolId?: string): Promise<StudentWithDetails[]>;
  getClassSubjects(classId: string): Promise<Subject[]>;
  getClassAssessments(classId: string, subjectId: string, term: string, session: string): Promise<(Assessment & { student: StudentWithDetails })[]>;
  
  // Assessment operations
  createOrUpdateAssessment(assessmentData: InsertAssessment): Promise<Assessment>;
  getStudentAssessments(studentId: string, term: string, session: string): Promise<(Assessment & { subject: Subject })[]>;
  
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
  
  assignFeesToStudent(studentId: string, feeTypeId: string, term: string, session: string, amount?: number): Promise<StudentFee>;
  getStudentFees(studentId: string, term?: string, session?: string): Promise<StudentFeeWithDetails[]>;
  getAllStudentFees(schoolId?: string, term?: string, session?: string): Promise<StudentFeeWithDetails[]>;
  updateStudentFeeStatus(id: string, status: string): Promise<StudentFee>;
  
  recordPayment(paymentData: InsertPayment): Promise<Payment>;
  getPayments(studentId?: string, studentFeeId?: string, schoolId?: string, term?: string, session?: string): Promise<PaymentWithDetails[]>;
  getPaymentById(id: string): Promise<PaymentWithDetails | undefined>;
  
  getFinancialSummary(schoolId?: string, term?: string, session?: string): Promise<{
    totalFees: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !user.isActive) return null;
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    return isValidPassword ? user : null;
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
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
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

  async updateUserProfile(userId: string, profileData: { firstName: string; lastName: string; email: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error('User not found');
    }
    
    return updatedUser;
  }

  async createStudent(studentData: InsertStudent): Promise<Student> {
    // Auto-generate student ID if not provided
    if (!studentData.studentId) {
      const existingStudents = await db.select().from(students);
      const nextNumber = (existingStudents.length + 1).toString().padStart(4, '0');
      studentData.studentId = `SOWA/${nextNumber}`;
    }
    
    const [student] = await db
      .insert(students)
      .values(studentData)
      .returning();
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

  async createSubject(subjectData: InsertSubject): Promise<Subject> {
    const [subject] = await db
      .insert(subjects)
      .values(subjectData)
      .returning();
    return subject;
  }

  async assignSubjectToClass(classId: string, subjectId: string): Promise<void> {
    await db.insert(classSubjects).values({ classId, subjectId });
  }

  async removeSubjectFromClass(classId: string, subjectId: string): Promise<void> {
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

  async updateSchool(schoolId: string, updateData: { name?: string; address?: string; phone?: string; email?: string }): Promise<School> {
    const [updatedSchool] = await db
      .update(schools)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(schools.id, schoolId))
      .returning();
    
    if (!updatedSchool) {
      throw new Error('School not found');
    }
    
    return updatedSchool;
  }

  async getSchoolById(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school || undefined;
  }

  async getAllUsers(): Promise<(User & { school?: School })[]> {
    const result = await db
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
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
      }
    }).from(classes).innerJoin(schools, eq(classes.schoolId, schools.id));
    
    if (schoolId) {
      return await baseQuery.where(eq(classes.schoolId, schoolId));
    }
    return await baseQuery;
  }

  async getClassById(classId: string): Promise<Class | undefined> {
    const [classData] = await db.select().from(classes).where(eq(classes.id, classId));
    return classData || undefined;
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async getStudentsByClass(classId: string): Promise<StudentWithDetails[]> {
    const studentsData = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.classId, classId));

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

  async getStudentsByClass(classId: string): Promise<(Student & { user: User })[]> {
    const results = await db
      .select()
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.classId, classId))
      .orderBy(asc(students.studentId));
    
    return results
      .filter(result => result.students && result.users)
      .map(result => ({
        ...result.students!,
        user: result.users!
      }));
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

    const total = Number(assessmentData.firstCA || 0) + 
                  Number(assessmentData.secondCA || 0) + 
                  Number(assessmentData.exam || 0);
    const grade = total >= 75 ? 'A' : total >= 50 ? 'C' : total >= 40 ? 'P' : 'F';

    if (existing) {
      // Update existing assessment
      const [updated] = await db
        .update(assessments)
        .set({
          ...assessmentData,
          total,
          grade,
          updatedAt: new Date()
        })
        .where(eq(assessments.id, existing.id))
        .returning();
      return updated;
    } else {
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

  async getStudentAssessments(studentId: string, term: string, session: string): Promise<(Assessment & { subject: Subject })[]> {
    const assessmentData = await db
      .select()
      .from(assessments)
      .leftJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(
        and(
          eq(assessments.studentId, studentId),
          eq(assessments.term, term),
          eq(assessments.session, session)
        )
      );

    return assessmentData.map(({ assessments: assessment, subjects: subject }) => ({
      ...assessment,
      subject: subject!
    }));
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
      query = query.where(eq(classes.schoolId, schoolId));
    }

    const studentsData = await query;

    return studentsData.map(({ students: student, users: user, classes: classData }) => ({
      ...student,
      user: user!,
      class: classData!,
      assessments: [] // Will be populated separately if needed
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
          eq(assessments.session, session)
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

  async getStudentFees(studentId: string, term?: string, session?: string): Promise<StudentFeeWithDetails[]> {
    const conditions = [eq(studentFees.studentId, studentId)];
    if (term) conditions.push(eq(studentFees.term, term));
    if (session) conditions.push(eq(studentFees.session, session));

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
      await db.select().from(payments).where(sql`${payments.studentFeeId} = ANY(${studentFeeIds})`) : [];

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

  async getPayments(studentId?: string, studentFeeId?: string, schoolId?: string, term?: string, session?: string): Promise<PaymentWithDetails[]> {
    const conditions = [];
    if (studentId) conditions.push(eq(payments.studentId, studentId));
    if (studentFeeId) conditions.push(eq(payments.studentFeeId, studentFeeId));
    if (term) conditions.push(eq(studentFees.term, term));
    if (session) conditions.push(eq(studentFees.session, session));
    if (schoolId) conditions.push(eq(feeTypes.schoolId, schoolId));

    let query = db
      .select()
      .from(payments)
      .leftJoin(studentFees, eq(payments.studentFeeId, studentFees.id))
      .leftJoin(feeTypes, eq(studentFees.feeTypeId, feeTypes.id))
      .leftJoin(students, eq(payments.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .orderBy(desc(payments.paymentDate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    return results.map(({ payments: payment, student_fees: studentFee, fee_types: feeType, students: student, users: user }) => ({
      ...payment,
      studentFee: studentFee ? {
        ...studentFee,
        feeType: feeType
      } : null,
      student: student ? {
        ...student,
        user: user
      } : null
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

  async getFinancialSummary(schoolId?: string, term?: string, session?: string): Promise<{
    totalFees: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  }> {
    // Get all student fees based on filters
    const studentFeesData = await this.getAllStudentFees(schoolId, term, session);
    
    let totalFees = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const studentFee of studentFeesData) {
      const feeAmount = Number(studentFee.amount);
      totalFees += feeAmount;

      if (studentFee.status === 'paid') {
        totalPaid += feeAmount;
      } else if (studentFee.status === 'pending') {
        totalPending += feeAmount;
      } else if (studentFee.status === 'overdue') {
        totalOverdue += feeAmount;
      }
    }

    return {
      totalFees,
      totalPaid,
      totalPending,
      totalOverdue
    };
  }
}

export const storage = new DatabaseStorage();