import {
  schools,
  users,
  students,
  classes,
  subjects,
  classSubjects,
  assessments,
  reportCardTemplates,
  type School,
  type User,
  type Student,
  type Class,
  type Subject,
  type Assessment,
  type ReportCardTemplate,
  type InsertUser,
  type InsertStudent,
  type InsertClass,
  type InsertSubject,
  type InsertAssessment,
  type InsertReportCardTemplate,
  type StudentWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Authentication
  authenticateUser(email: string, password: string): Promise<User | null>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // School operations
  getAllSchools(): Promise<School[]>;
  getSchoolById(id: string): Promise<School | undefined>;
  
  // Admin operations
  createUser(userData: InsertUser): Promise<User>;
  createStudent(studentData: InsertStudent): Promise<Student>;
  createClass(classData: InsertClass): Promise<Class>;
  createSubject(subjectData: InsertSubject): Promise<Subject>;
  assignSubjectToClass(classId: string, subjectId: string): Promise<void>;
  
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

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...userData, password: hashedPassword })
      .returning();
    return user;
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

  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchoolById(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school || undefined;
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

  async createOrUpdateAssessment(assessmentData: InsertAssessment): Promise<Assessment> {
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
      // Update existing assessment
      const [updated] = await db
        .update(assessments)
        .set({
          ...assessmentData,
          total: String(
            Number(assessmentData.firstCA || 0) +
            Number(assessmentData.secondCA || 0) +
            Number(assessmentData.exam || 0)
          ),
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
          total: String(
            Number(assessmentData.firstCA || 0) +
            Number(assessmentData.secondCA || 0) +
            Number(assessmentData.exam || 0)
          )
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
}

export const storage = new DatabaseStorage();