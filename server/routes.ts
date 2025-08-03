import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClassSchema, 
  insertSubjectSchema,
  addScoreSchema,
  insertStudentSchema
} from "@shared/schema";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware for authentication
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    (req as any).user = user;
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
  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.authenticateUser(email, password);
      
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

  // Admin routes - Class management
  app.get('/api/admin/classes', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = req.query.schoolId as string || user.schoolId;
      
      // Sub-admin can only see their school's classes
      if (user.role === 'sub-admin' && schoolId !== user.schoolId) {
        return res.status(403).json({ error: "Access denied to this school's data" });
      }
      
      const classes = await storage.getAllClasses(schoolId);
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
        await import('../client/src/lib/firebase-sync.js').then(module => {
          if (module.syncToFirebase?.class) {
            module.syncToFirebase.class(newClass);
          }
        });
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

  // Users routes
  app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
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
      const studentData = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(studentData);
      res.json(student);
    } catch (error) {
      console.error("Create student error:", error);
      res.status(400).json({ error: "Failed to create student" });
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
      if (user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const assessmentData = addScoreSchema.parse(req.body);
      
      // Get student's class info
      const student = await storage.getStudentByUserId(assessmentData.studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const assessment = await storage.createOrUpdateAssessment({
        studentId: assessmentData.studentId,
        subjectId: assessmentData.subjectId,
        classId: student.classId,
        term: assessmentData.term,
        session: assessmentData.session,
        firstCA: assessmentData.firstCA?.toString(),
        secondCA: assessmentData.secondCA?.toString(),
        exam: assessmentData.exam?.toString()
      });

      res.json(assessment);
    } catch (error) {
      console.error("Create/update assessment error:", error);
      res.status(400).json({ error: "Failed to save assessment" });
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

  const httpServer = createServer(app);
  return httpServer;
}