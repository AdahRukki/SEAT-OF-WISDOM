import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import express from "express";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClassSchema, 
  insertSubjectSchema,
  addScoreSchema,
  insertStudentSchema,
  changePasswordSchema,
  insertFeeTypeSchema,
  recordPaymentSchema,
  assignFeeSchema
} from "@shared/schema";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Store invalidated tokens (in production, use Redis or database)
const invalidatedTokens = new Set<string>();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware for authentication
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Check if token has been invalidated
    if (invalidatedTokens.has(token)) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    (req as any).user = user;
    (req as any).token = token; // Store token for potential invalidation
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware for admin-only routes (admin or sub-admin)
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user.role !== 'admin' && user.role !== 'sub-admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Middleware for main admin only (access to all schools)
const requireMainAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: "Main admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static assets first (before other routes)
  app.use('/assets', express.static(path.join(process.cwd(), 'client/src/assets')));

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      let user = null;
      
      // Try login by email first
      user = await storage.authenticateUser(email, password);
      
      // If not found and looks like student ID (SOWA/format), try student ID login
      if (!user && email.includes('/')) {
        user = await storage.authenticateUserByStudentId(email, password);
      }
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Password reset endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If this email exists, you will receive reset instructions.' });
      }

      // For demo purposes, we'll just return success
      // In production, you would generate a reset token and send an email
      console.log(`Password reset requested for: ${email}`);
      
      res.json({ message: 'If this email exists, you will receive reset instructions.' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = (req as any).user;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      schoolId: user.schoolId
    });
  });

  // Logout endpoint
  app.get('/api/auth/logout', (req, res) => {
    // Clear any server-side session or token if applicable
    res.clearCookie('token');
    res.redirect('/');
  });

  // Update user profile
  app.put("/api/auth/profile", authenticate, async (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const userId = (req as any).user.id;
      const updatedUser = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        email
      });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        schoolId: updatedUser.schoolId
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Get all schools (main admin only)
  app.get('/api/admin/schools', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const schools = await storage.getAllSchools();
      res.json(schools);
    } catch (error) {
      console.error("Get schools error:", error);
      res.status(500).json({ error: "Failed to fetch schools" });
    }
  });

  // Update school endpoint
  app.put('/api/admin/schools/:id', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, phone, email } = req.body;
      const updatedSchool = await storage.updateSchool(id, { name, address, phone, email });
      res.json(updatedSchool);
    } catch (error) {
      console.error('Error updating school:', error);
      res.status(500).json({ error: 'Failed to update school' });
    }
  });

  // Admin routes - User management
  app.post('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  // Academic Sessions and Terms Management
  app.get('/api/admin/academic-sessions', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const sessions = await storage.getAcademicSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Get academic sessions error:", error);
      res.status(500).json({ error: "Failed to fetch academic sessions" });
    }
  });

  app.post('/api/admin/academic-sessions', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const sessionData = req.body;
      const session = await storage.createAcademicSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Create academic session error:", error);
      res.status(400).json({ error: "Failed to create academic session" });
    }
  });

  app.get('/api/admin/academic-terms', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      const terms = await storage.getAcademicTerms(sessionId);
      res.json(terms);
    } catch (error) {
      console.error("Get academic terms error:", error);
      res.status(500).json({ error: "Failed to fetch academic terms" });
    }
  });

  app.post('/api/admin/academic-terms', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const termData = req.body;
      const term = await storage.createAcademicTerm(termData);
      res.json(term);
    } catch (error) {
      console.error("Create academic term error:", error);
      res.status(400).json({ error: "Failed to create academic term" });
    }
  });

  app.put('/api/admin/academic-sessions/:id/activate', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.setActiveAcademicSession(id);
      res.json(session);
    } catch (error) {
      console.error("Activate session error:", error);
      res.status(400).json({ error: "Failed to activate session" });
    }
  });

  app.put('/api/admin/academic-terms/:id/activate', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const term = await storage.setActiveTerm(id);
      res.json(term);
    } catch (error) {
      console.error("Activate term error:", error);
      res.status(400).json({ error: "Failed to activate term" });
    }
  });

  // Student Promotion System
  app.post('/api/admin/promote-students', authenticate, requireAdmin, async (req, res) => {
    try {
      const { currentClassId, nextClassId, studentIds } = req.body;
      
      if (nextClassId === 'graduated') {
        await storage.markStudentsAsGraduated(studentIds);
      } else {
        await storage.promoteStudentsToNextClass(currentClassId, nextClassId, studentIds);
      }
      
      res.json({ message: "Students promoted successfully" });
    } catch (error) {
      console.error("Promote students error:", error);
      res.status(400).json({ error: "Failed to promote students" });
    }
  });

  // Admin routes - Class management
  app.get('/api/admin/classes', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = req.query.schoolId as string || user.schoolId;
      
      console.log(`[DEBUG] Classes request - User role: ${user.role}, User schoolId: ${user.schoolId}, Query schoolId: ${req.query.schoolId}, Final schoolId: ${schoolId}`);
      
      // Sub-admin can only see their school's classes
      if (user.role === 'sub-admin' && schoolId !== user.schoolId) {
        return res.status(403).json({ error: "Access denied to this school's data" });
      }
      
      const classes = await storage.getAllClasses(schoolId);
      console.log(`[DEBUG] Found ${classes.length} classes for schoolId: ${schoolId}`);
      
      res.json(classes);
    } catch (error) {
      console.error("Get classes error:", error);
      res.status(500).json({ error: "Failed to fetch classes" });
    }
  });

  app.post('/api/admin/classes', authenticate, requireAdmin, async (req, res) => {
    try {
      const classData = insertClassSchema.parse(req.body);
      const newClass = await storage.createClass(classData);
      
      // Sync to Firebase after successful creation
      try {
        const firebaseSync = await import('../client/src/lib/firebase-sync.js');
        if (firebaseSync && typeof firebaseSync.syncClassToFirebase === 'function') {
          await firebaseSync.syncClassToFirebase(newClass);
        }
      } catch (syncError) {
        console.warn("Firebase sync failed:", syncError);
      }
      
      res.json(newClass);
    } catch (error) {
      console.error("Create class error:", error);
      res.status(400).json({ error: "Failed to create class" });
    }
  });

  // Admin routes - Subject management
  app.get('/api/admin/subjects', authenticate, requireAdmin, async (req, res) => {
    try {
      const subjects = await storage.getAllSubjects();
      res.json(subjects);
    } catch (error) {
      console.error("Get subjects error:", error);
      res.status(500).json({ error: "Failed to fetch subjects" });
    }
  });

  app.post('/api/admin/subjects', authenticate, requireAdmin, async (req, res) => {
    try {
      const subjectData = insertSubjectSchema.parse(req.body);
      const subject = await storage.createSubject(subjectData);
      res.json(subject);
    } catch (error) {
      console.error("Create subject error:", error);
      res.status(400).json({ error: "Failed to create subject" });
    }
  });

  // Get subjects for a specific class
  app.get('/api/admin/classes/:classId/subjects', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      const subjects = await storage.getClassSubjects(classId);
      res.json(subjects);
    } catch (error) {
      console.error("Get class subjects error:", error);
      res.status(500).json({ error: "Failed to fetch class subjects" });
    }
  });

  // Admin routes - Assign subject to class
  app.post('/api/admin/classes/:classId/subjects/:subjectId', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, subjectId } = req.params;
      await storage.assignSubjectToClass(classId, subjectId);
      res.json({ message: "Subject assigned to class successfully" });
    } catch (error) {
      console.error("Assign subject error:", error);
      res.status(400).json({ error: "Failed to assign subject to class" });
    }
  });

  // Remove subject from class
  app.delete('/api/admin/classes/:classId/subjects/:subjectId', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, subjectId } = req.params;
      await storage.removeSubjectFromClass(classId, subjectId);
      res.json({ message: "Subject removed from class successfully" });
    } catch (error) {
      console.error("Remove subject error:", error);
      res.status(400).json({ error: "Failed to remove subject from class" });
    }
  });

  // Users routes
  app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
      const adminOnly = req.query.adminOnly === 'true';
      const users = await storage.getAllUsers(adminOnly);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Delete user (admin only)
  app.delete('/api/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deletion of admin users
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (user.role === 'admin') {
        return res.status(403).json({ error: 'Cannot delete admin users' });
      }
      
      await storage.deleteUser(id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.post('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      res.json(newUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  // School logo upload route
  app.post('/api/admin/schools/logo', authenticate, requireAdmin, async (req, res) => {
    try {
      const { schoolId, logoUrl } = req.body;
      
      if (!schoolId || !logoUrl) {
        return res.status(400).json({ error: "School ID and logo URL are required" });
      }

      const updatedSchool = await storage.updateSchoolLogo(schoolId, logoUrl);
      res.json(updatedSchool);
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(400).json({ error: "Failed to upload logo" });
    }
  });

  // Admin routes - Student management
  app.post('/api/admin/students', authenticate, requireAdmin, async (req, res) => {
    try {
      const { 
        firstName, 
        lastName, 
        middleName,
        email, 
        password, 
        classId,
        dateOfBirth,
        parentContact,
        parentWhatsApp,
        address,
        schoolId: requestSchoolId
      } = req.body;
      
      // Required fields validation
      if (!firstName || !lastName || !email || !password || !classId || !parentWhatsApp) {
        return res.status(400).json({ error: "Required fields: firstName, lastName, email, password, classId, parentWhatsApp" });
      }

      // Get the school ID - for sub-admins use their schoolId, for main admin get it from request or class
      const user = (req as any).user;
      let schoolId: string;
      
      if (user.role === 'admin') {
        // Main admin: use provided schoolId or get from class
        if (requestSchoolId) {
          schoolId = requestSchoolId;
        } else {
          const classData = await storage.getClassById(classId);
          if (!classData) {
            return res.status(400).json({ error: "Invalid class selected" });
          }
          schoolId = classData.schoolId!;
        }
      } else {
        // Sub-admin: use their assigned school
        schoolId = user.schoolId;
      }

      // Validate single words only (no spaces allowed for names)
      if (firstName.includes(' ') || lastName.includes(' ') || (middleName && middleName.includes(' '))) {
        return res.status(400).json({ error: "Names must be single words without spaces" });
      }

      // Auto-generate student ID in SOWA/x000 format
      const schoolNumber = await storage.getSchoolNumber(schoolId);
      const studentCount = await storage.getStudentCountForSchool(schoolId);
      const autoStudentId = `SOWA/${schoolNumber}${(studentCount + 1).toString().padStart(3, '0')}`;

      // First create the user account
      const userData = insertUserSchema.parse({
        firstName,
        lastName,
        email,
        password,
        role: 'student',
        schoolId: schoolId
      });
      
      const newUser = await storage.createUser(userData);
      
      // Then create the student record with comprehensive data
      const studentData = insertStudentSchema.parse({
        userId: newUser.id,
        classId,
        studentId: autoStudentId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        parentContact: parentContact || '',
        parentWhatsapp: parentWhatsApp,
        address: address || ''
      });
      
      const student = await storage.createStudent(studentData);
      
      res.json({ 
        message: "Student created successfully",
        user: newUser, 
        student,
        studentId: autoStudentId
      });
    } catch (error) {
      console.error("Create student error:", error);
      res.status(500).json({ error: error.message || "Failed to create student" });
    }
  });

  app.get('/api/admin/classes/:classId/students', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      const students = await storage.getStudentsByClass(classId);
      res.json(students);
    } catch (error) {
      console.error("Get students error:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get all students (admin only, school-aware)
  app.get('/api/admin/students', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = req.query.schoolId as string || user.schoolId;
      
      // Sub-admin can only see their school's students
      if (user.role === 'sub-admin' && schoolId !== user.schoolId) {
        return res.status(403).json({ error: "Access denied to this school's data" });
      }
      
      const students = await storage.getAllStudentsWithDetails(schoolId);
      res.json(students);
    } catch (error) {
      console.error("Get all students error:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get class subjects (admin only)
  app.get('/api/admin/classes/:classId/subjects', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      const subjects = await storage.getClassSubjects(classId);
      res.json(subjects);
    } catch (error) {
      console.error("Get class subjects error:", error);
      res.status(500).json({ error: "Failed to fetch class subjects" });
    }
  });

  // Get assessments for class and subject
  app.get('/api/admin/assessments', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, subjectId, term, session } = req.query;
      const assessments = await storage.getClassAssessments(
        classId as string,
        subjectId as string,
        term as string,
        session as string
      );
      res.json(assessments);
    } catch (error) {
      console.error("Get class assessments error:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Bulk score update endpoint
  app.post('/api/admin/scores/bulk-update', authenticate, requireAdmin, async (req, res) => {
    try {
      const { scores } = req.body;
      const results = [];
      
      for (const scoreData of scores) {
        const total = (scoreData.firstCA || 0) + (scoreData.secondCA || 0) + (scoreData.exam || 0);
        const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
        
        const assessment = await storage.createOrUpdateAssessment({
          ...scoreData,
          total,
          grade
        });
        results.push(assessment);
      }
      
      res.json({ message: "Scores updated successfully", results });
    } catch (error) {
      console.error("Bulk score update error:", error);
      res.status(500).json({ error: "Failed to update scores" });
    }
  });

  // Student routes
  app.get('/api/student/profile', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const student = await storage.getStudentByUserId(user.id);
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      res.json(student);
    } catch (error) {
      console.error("Get student profile error:", error);
      res.status(500).json({ error: "Failed to fetch student profile" });
    }
  });

  app.get('/api/student/assessments', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const { term = "First Term", session = "2024/2025" } = req.query;
      const student = await storage.getStudentByUserId(user.id);
      
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const assessments = await storage.getStudentAssessments(
        student.id, 
        term as string, 
        session as string
      );
      
      res.json(assessments);
    } catch (error) {
      console.error("Get student assessments error:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Admin/Teacher routes - Assessment management
  app.post('/api/assessments', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const assessmentData = addScoreSchema.parse(req.body);
      
      console.log("[DEBUG] Assessment data received:", assessmentData);
      console.log("[DEBUG] Frontend classId being sent:", req.body.classId);
      
      const assessment = await storage.createOrUpdateAssessment({
        studentId: assessmentData.studentId,
        subjectId: assessmentData.subjectId,
        classId: assessmentData.classId,
        term: assessmentData.term,
        session: assessmentData.session,
        firstCA: assessmentData.firstCA,
        secondCA: assessmentData.secondCA,
        exam: assessmentData.exam
      });

      res.json(assessment);
    } catch (error) {
      console.error("Create/update assessment error:", error);
      res.status(400).json({ error: "Failed to save assessment" });
    }
  });

  // Excel upload for bulk score updates
  app.post('/api/assessments/upload', authenticate, upload.single('excelFile'), async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { classId, subjectId, term, session } = req.body;
      if (!classId || !subjectId || !term || !session) {
        return res.status(400).json({ 
          error: "Missing required fields: classId, subjectId, term, session" 
        });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log("[DEBUG] Excel data parsed:", data);

      // Process each row
      const results = [];
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          // Map Excel columns to our data structure
          // Expected columns: Student ID, First CA, Second CA, Exam
          const studentId = row['Student ID'] || row['student_id'] || row['studentId'];
          const firstCA = parseFloat(row['First CA'] || row['first_ca'] || row['firstCA'] || '0');
          const secondCA = parseFloat(row['Second CA'] || row['second_ca'] || row['secondCA'] || '0');
          const exam = parseFloat(row['Exam'] || row['exam'] || '0');

          if (!studentId) {
            errors.push(`Row ${i + 2}: Missing student ID`);
            continue;
          }

          // Find student by studentId (SOWA/0001 format)
          const student = await storage.getStudentByStudentId(studentId);
          if (!student) {
            errors.push(`Row ${i + 2}: Student ${studentId} not found`);
            continue;
          }

          // Validate scores
          if (firstCA < 0 || firstCA > 20) {
            errors.push(`Row ${i + 2}: First CA must be between 0-20`);
            continue;
          }
          if (secondCA < 0 || secondCA > 20) {
            errors.push(`Row ${i + 2}: Second CA must be between 0-20`);
            continue;
          }
          if (exam < 0 || exam > 60) {
            errors.push(`Row ${i + 2}: Exam must be between 0-60`);
            continue;
          }

          // Create or update assessment
          const assessment = await storage.createOrUpdateAssessment({
            studentId: student.id,
            subjectId,
            classId,
            term,
            session,
            firstCA,
            secondCA,
            exam
          });

          results.push({
            studentId,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            firstCA,
            secondCA,
            exam,
            total: firstCA + secondCA + exam,
            status: 'success'
          });

        } catch (error) {
          console.error(`Error processing row ${i + 2}:`, error);
          errors.push(`Row ${i + 2}: ${(error as Error).message || 'Processing error'}`);
        }
      }

      res.json({
        message: `Processed ${results.length} students successfully`,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors
      });

    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  // Download Excel template for bulk score upload
  app.get('/api/assessments/template/:classId', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { classId } = req.params;
      
      // Get students from the class
      const studentsInClass = await storage.getStudentsByClass(classId);
      
      // Create Excel template with student IDs
      const templateData = studentsInClass.map(student => ({
        'Student ID': student.studentId,
        'Student Name': `${student.user.firstName} ${student.user.lastName}`,
        'First CA': '',
        'Second CA': '',
        'Exam': ''
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths
      ws['!cols'] = [
        { width: 15 }, // Student ID
        { width: 25 }, // Student Name
        { width: 12 }, // First CA
        { width: 12 }, // Second CA
        { width: 12 }  // Exam
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Scores Template');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="scores_template_${classId}.xlsx"`,
        'Content-Length': buffer.length
      });

      res.send(buffer);

    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Report card template routes
  app.get('/api/admin/report-templates', authenticate, requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getReportCardTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Get report templates error:", error);
      res.status(500).json({ error: "Failed to fetch report templates" });
    }
  });

  app.get('/api/report-template/default', authenticate, async (req, res) => {
    try {
      const template = await storage.getDefaultReportCardTemplate();
      res.json(template || null);
    } catch (error) {
      console.error("Get default template error:", error);
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });

  // Logo upload endpoint - Global academy logo
  app.post('/api/admin/logo', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { logoUrl } = req.body;
      
      if (!logoUrl) {
        return res.status(400).json({ error: "Logo URL is required" });
      }

      // Store the global logo URL in settings table
      await storage.setSetting('academy_logo', logoUrl);
      console.log(`Global academy logo updated: ${logoUrl}`);
      
      res.json({ message: "Logo updated successfully", logoUrl });
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // Get current logo endpoint (admin authenticated)
  app.get('/api/admin/logo', authenticate, async (req, res) => {
    try {
      // Get the logo from settings table
      const logoSetting = await storage.getSetting('academy_logo');
      const logoUrl = logoSetting?.value || "/assets/4oWHptM_1754171230437.gif"; // Default fallback logo
      res.json({ logoUrl });
    } catch (error) {
      console.error("Get logo error:", error);
      res.status(500).json({ error: "Failed to get logo" });
    }
  });

  // Public logo endpoint (no authentication required)
  app.get('/api/logo', async (req, res) => {
    try {
      // Get the logo from settings table
      const logoSetting = await storage.getSetting('academy_logo');
      const logoUrl = logoSetting?.value || "/assets/4oWHptM_1754171230437.gif"; // Default fallback logo
      res.json({ logoUrl });
    } catch (error) {
      console.error("Get logo error:", error);
      res.status(500).json({ error: "Failed to get logo" });
    }
  });

  // Change password endpoint (for students and other users)
  app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      const passwordData = changePasswordSchema.parse(req.body);

      // Verify current password
      const isCurrentPasswordValid = await storage.verifyPassword(user.email, passwordData.currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Update password
      await storage.updateUserPassword(user.id, passwordData.newPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      if ((error as any).issues) {
        return res.status(400).json({ error: (error as any).issues[0].message });
      }
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Logout endpoint for comprehensive session cleanup
  app.post('/api/logout', async (req, res) => {
    try {
      // Get token from Authorization header
      const token = req.headers.authorization?.split(' ')[1];
      
      // Invalidate the JWT token if present
      if (token) {
        invalidatedTokens.add(token);
        console.log('Token invalidated:', token.substring(0, 20) + '...');
      }
      
      // Destroy the session if it exists
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destruction error:", err);
          }
        });
      }
      
      // Clear all authentication cookies
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('auth_token', { path: '/' });
      res.clearCookie('session', { path: '/' });
      
      // Set aggressive security headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Accel-Expires': '0',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
      });
      
      res.json({ 
        message: 'Logged out successfully',
        timestamp: Date.now(),
        tokenInvalidated: !!token 
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // ===== FINANCIAL MANAGEMENT ROUTES =====

  // Fee Types Management
  app.post('/api/admin/fee-types', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const feeTypeData = insertFeeTypeSchema.parse(req.body);
      
      // Sub-admins can only create fee types for their school
      if (user.role === 'sub-admin') {
        feeTypeData.schoolId = user.schoolId;
      }

      const feeType = await storage.createFeeType(feeTypeData);
      res.json(feeType);
    } catch (error) {
      console.error("Create fee type error:", error);
      if (error.issues) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: "Failed to create fee type" });
    }
  });

  app.get('/api/admin/fee-types', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = user.role === 'sub-admin' ? user.schoolId : req.query.schoolId as string;
      
      const feeTypes = await storage.getFeeTypes(schoolId);
      res.json(feeTypes);
    } catch (error) {
      console.error("Get fee types error:", error);
      res.status(500).json({ error: "Failed to fetch fee types" });
    }
  });

  app.put('/api/admin/fee-types/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const feeType = await storage.updateFeeType(id, updateData);
      res.json(feeType);
    } catch (error) {
      console.error("Update fee type error:", error);
      res.status(500).json({ error: "Failed to update fee type" });
    }
  });

  app.delete('/api/admin/fee-types/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFeeType(id);
      res.json({ message: "Fee type deleted successfully" });
    } catch (error) {
      console.error("Delete fee type error:", error);
      res.status(500).json({ error: "Failed to delete fee type" });
    }
  });

  // Student Fees Management
  app.post('/api/admin/student-fees', authenticate, requireAdmin, async (req, res) => {
    try {
      const { studentId, feeTypeId, term, session, amount } = req.body;
      
      const studentFee = await storage.assignFeesToStudent(studentId, feeTypeId, term, session, amount);
      res.json(studentFee);
    } catch (error) {
      console.error("Assign student fee error:", error);
      res.status(500).json({ error: "Failed to assign fee to student" });
    }
  });

  app.get('/api/admin/student-fees', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = user.role === 'sub-admin' ? user.schoolId : req.query.schoolId as string;
      const term = req.query.term as string;
      const session = req.query.session as string;
      
      const studentFees = await storage.getAllStudentFees(schoolId, term, session);
      res.json(studentFees);
    } catch (error) {
      console.error("Get student fees error:", error);
      res.status(500).json({ error: "Failed to fetch student fees" });
    }
  });

  app.get('/api/student/fees', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only students can access this endpoint
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const student = await storage.getStudentByUserId(user.id);
      if (!student) {
        return res.status(404).json({ error: "Student record not found" });
      }

      const term = req.query.term as string;
      const session = req.query.session as string;
      
      const studentFees = await storage.getStudentFees(student.id, term, session);
      res.json(studentFees);
    } catch (error) {
      console.error("Get student fees error:", error);
      res.status(500).json({ error: "Failed to fetch student fees" });
    }
  });

  // Payments Management
  app.post('/api/admin/payments', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const paymentData = recordPaymentSchema.parse(req.body);
      
      // Get the student fee to get student ID
      const studentFeeResult = await storage.getAllStudentFees();
      const studentFee = studentFeeResult.find(sf => sf.id === paymentData.studentFeeId);
      
      if (!studentFee) {
        return res.status(404).json({ error: "Student fee not found" });
      }

      const payment = await storage.recordPayment({
        studentId: studentFee.studentId,
        studentFeeId: paymentData.studentFeeId,
        amount: paymentData.amount.toString(),
        paymentMethod: paymentData.paymentMethod || "cash",
        reference: paymentData.reference,
        paymentDate: new Date(paymentData.paymentDate),
        recordedBy: user.id,
        notes: paymentData.notes
      });

      res.json(payment);
    } catch (error) {
      console.error("Record payment error:", error);
      if ((error as any).issues) {
        return res.status(400).json({ error: (error as any).issues[0].message });
      }
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  // Assign fee to class
  app.post('/api/admin/assign-fee', authenticate, requireAdmin, async (req, res) => {
    try {
      const assignmentData = assignFeeSchema.parse(req.body);
      
      const assignedFees = await storage.assignFeeToClass(
        assignmentData.classId,
        assignmentData.feeTypeId,
        assignmentData.term,
        assignmentData.session,
        assignmentData.dueDate,
        assignmentData.notes
      );

      res.json({ 
        message: `Successfully assigned fee to ${assignedFees.length} students`,
        assignedFees 
      });
    } catch (error) {
      console.error("Assign fee error:", error);
      if ((error as any).issues) {
        return res.status(400).json({ error: (error as any).issues[0].message });
      }
      res.status(500).json({ error: "Failed to assign fee to class" });
    }
  });

  app.get('/api/admin/payments', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = user.role === 'sub-admin' ? user.schoolId : req.query.schoolId as string;
      const term = req.query.term as string;
      const session = req.query.session as string;
      const studentId = req.query.studentId as string;
      const studentFeeId = req.query.studentFeeId as string;
      
      const payments = await storage.getPayments(studentId, studentFeeId, schoolId, term, session);
      res.json(payments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.get('/api/student/payments', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only students can access this endpoint
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const student = await storage.getStudentByUserId(user.id);
      if (!student) {
        return res.status(404).json({ error: "Student record not found" });
      }
      
      const term = req.query.term as string;
      const session = req.query.session as string;
      
      const payments = await storage.getPayments(student.id, undefined, undefined, term, session);
      res.json(payments);
    } catch (error) {
      console.error("Get student payments error:", error);
      res.status(500).json({ error: "Failed to fetch student payments" });
    }
  });

  // Financial Summary
  app.get('/api/admin/financial-summary', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = user.role === 'sub-admin' ? user.schoolId : req.query.schoolId as string;
      const term = req.query.term as string;
      const session = req.query.session as string;
      
      const summary = await storage.getFinancialSummary(schoolId, term, session);
      res.json(summary);
    } catch (error) {
      console.error("Get financial summary error:", error);
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}