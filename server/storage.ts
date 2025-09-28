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
  studentFees,
  payments,
  settings,
  academicSessions,
  academicTerms,
  nonAcademicRatings,
  calendarEvents,
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
  type StudentFee,
  type Payment,
  type Setting,
  type AcademicSession,
  type AcademicTerm,
  type NonAcademicRating,
  type CalendarEvent,
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
  type StudentWithDetails,
  type StudentFeeWithDetails,
  type PaymentWithDetails,
  calculateGrade
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Authentication
  authenticateUser(email: string, password: string): Promise<User | null>;
  authenticateUserByStudentId(studentId: string, password: string): Promise<User | null>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<boolean>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  
  // School operations
  getAllSchools(): Promise<School[]>;
  getSchoolById(id: string): Promise<School | undefined>;
  
  // Admin operations
  getAllUsers(adminOnly?: boolean): Promise<(User & { school?: School })[]>;
  createUser(userData: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  updateSchoolLogo(schoolId: string, logoUrl: string): Promise<School>;
  createStudent(studentData: InsertStudent): Promise<Student>;
  updateStudent(studentId: string, updateData: Partial<InsertStudent>): Promise<Student>;
  updateStudentProfileImage(studentId: string, profileImagePath: string): Promise<Student>;
  getStudent(studentId: string): Promise<Student | undefined>;
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
  getAssessmentsByClassTermSession(classId: string, term: string, session: string): Promise<(Assessment & { subject: Subject })[]>;
  
  // Non-academic rating operations
  createOrUpdateNonAcademicRating(ratingData: InsertNonAcademicRating): Promise<NonAcademicRating>;
  getNonAcademicRatingsByClass(classId: string, term: string, session: string): Promise<NonAcademicRating[]>;
  
  // Calendar operations
  createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEvents(schoolId?: string): Promise<CalendarEvent[]>;
  
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
  assignFeeToClass(classId: string, feeTypeId: string, term: string, session: string, dueDate: string, notes?: string): Promise<StudentFee[]>;
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

  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;

  // Current academic info
  getCurrentAcademicInfo(): Promise<{
    currentSession: string | null;
    currentTerm: string | null;
  }>;

  // Academic sessions and terms management
  createAcademicSession(sessionData: InsertAcademicSession): Promise<AcademicSession>;
  getAcademicSessions(): Promise<AcademicSession[]>;
  getActiveAcademicSession(): Promise<AcademicSession | undefined>;
  setActiveAcademicSession(sessionId: string): Promise<AcademicSession>;
  
  createAcademicTerm(termData: InsertAcademicTerm): Promise<AcademicTerm>;
  getAcademicTerms(sessionId?: string): Promise<AcademicTerm[]>;
  getActiveTerm(): Promise<AcademicTerm | undefined>;
  setActiveTerm(termId: string): Promise<AcademicTerm>;
  
  // Student promotion system
  promoteStudentsToNextClass(currentClassId: string, nextClassId: string, studentIds: string[]): Promise<void>;
  markStudentsAsGraduated(studentIds: string[]): Promise<void>;
  
  // Attendance tracking
  getStudentAttendance(studentId: string, term?: string, session?: string): Promise<Attendance[]>;
  getClassAttendance(classId: string, term: string, session: string): Promise<(Attendance & { student: StudentWithDetails })[]>;
  upsertAttendance(attendanceData: InsertAttendance): Promise<Attendance>;
  getAttendanceByStudent(studentId: string, term: string, session: string): Promise<Attendance | undefined>;

  // Report Card operations
  getAllGeneratedReportCards(): Promise<GeneratedReportCard[]>;
  getGeneratedReportCardsByStudent(studentId: string): Promise<GeneratedReportCard[]>;
  getGeneratedReportCardsByClass(classId: string): Promise<GeneratedReportCard[]>;
  createGeneratedReportCard(reportCardData: InsertGeneratedReportCard): Promise<GeneratedReportCard>;
  deleteGeneratedReportCard(reportCardId: string): Promise<void>;
  validateReportCardData(studentId: string, classId: string, term: string, session: string): Promise<{ hasAllScores: boolean; hasAttendance: boolean; missingSubjects: string[] }>;
  
  // Enhanced student creation helpers
  getSchoolNumber(schoolId: string): Promise<string>;
  getStudentCountForSchool(schoolId: string): Promise<number>;
  getClassById(classId: string): Promise<Class | undefined>;
  updateSchool(schoolId: string, data: Partial<School>): Promise<School>;
  updateUserProfile(userId: string, data: Partial<User>): Promise<User>;
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



  async createStudent(studentData: InsertStudent): Promise<Student> {
    // Auto-generate student ID if not provided
    if (!studentData.studentId) {
      // Get the school through the class to determine the school number
      const classData = await db
        .select({ schoolId: classes.schoolId })
        .from(classes)
        .where(eq(classes.id, studentData.classId!))
        .limit(1);
      
      let schoolNumber = '1'; // Default to school 1
      
      if (classData.length > 0) {
        const school = await db
          .select()
          .from(schools)
          .where(eq(schools.id, classData[0].schoolId))
          .limit(1);
        
        if (school.length > 0) {
          // Extract school number from school name (e.g., "School 1" -> "1")
          const schoolName = school[0].name;
          const match = schoolName.match(/School (\d+)/i);
          if (match) {
            schoolNumber = match[1];
          }
        }
      }
      
      // Get existing students for this school to determine next number
      const existingStudents = await db
        .select()
        .from(students)
        .leftJoin(classes, eq(students.classId, classes.id))
        .where(eq(classes.schoolId, classData.length > 0 ? classData[0].schoolId : ''));
      
      const nextNumber = (existingStudents.length + 1).toString().padStart(3, '0');
      studentData.studentId = `SOWA/${schoolNumber}${nextNumber}`;
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









  async getCurrentAcademicInfo(): Promise<{
    currentSession: string | null;
    currentTerm: string | null;
  }> {
    try {
      // Get active session
      const [activeSession] = await db
        .select()
        .from(academicSessions)
        .where(eq(academicSessions.isActive, true));

      // Get active term
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
      return {
        currentSession: null,
        currentTerm: null
      };
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
        parentContact: students.parentContact,
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
  async getAllGeneratedReportCards(): Promise<GeneratedReportCard[]> {
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
}

export const storage = new DatabaseStorage();