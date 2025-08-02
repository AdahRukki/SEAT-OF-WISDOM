import {
  users,
  students,
  classes,
  subjects,
  classSubjects,
  assessments,
  reportCardTemplates,
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
  
  // Admin operations
  createUser(userData: InsertUser): Promise<User>;
  createStudent(studentData: InsertStudent): Promise<Student>;
  createClass(classData: InsertClass): Promise<Class>;
  createSubject(subjectData: InsertSubject): Promise<Subject>;
  assignSubjectToClass(classId: string, subjectId: string): Promise<void>;
  
  // Data retrieval
  getAllClasses(): Promise<Class[]>;
  getAllSubjects(): Promise<Subject[]>;
  getStudentsByClass(classId: string): Promise<StudentWithDetails[]>;
  getStudentByUserId(userId: string): Promise<StudentWithDetails | undefined>;
  
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

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...userData, password: hashedPassword })
      .returning();
    return user;
  }

  async createStudent(studentData: InsertStudent): Promise<Student> {
    const [student] = await db
      .insert(students)
      .values(studentData)
      .returning();
    return student;
  }

  async createClass(classData: InsertClass): Promise<Class> {
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

  async getAllClasses(): Promise<Class[]> {
    return await db.select().from(classes);
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
}

export const storage = new DatabaseStorage();