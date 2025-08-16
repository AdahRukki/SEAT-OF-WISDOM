import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import express from "express";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { 
  loginSchema, 
  insertUserSchema, 
  insertClassSchema, 
  insertSubjectSchema,
  addScoreSchema,
  addAttendanceSchema,
  insertStudentSchema,
  changePasswordSchema,
  insertFeeTypeSchema,
  recordPaymentSchema,
  assignFeeSchema,
  users,
  students,
  classes
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
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

// Helper function to format dates as "12th of September 2025" (day before month)
function formatDateWithOrdinal(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  
  // Get ordinal suffix for day
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  return `${day}${getOrdinalSuffix(day)} of ${month} ${year}`;
}

// Helper function to calculate grade from score
function calculateGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'A', color: 'bg-green-500' };
  if (score >= 80) return { grade: 'B', color: 'bg-blue-500' };
  if (score >= 70) return { grade: 'C', color: 'bg-yellow-500' };
  if (score >= 60) return { grade: 'D', color: 'bg-orange-500' };
  return { grade: 'F', color: 'bg-red-500' };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Report card viewing route (public access, based on August 3rd working patterns)
  app.get("/reports/:reportId", async (req: Request, res: Response) => {
    const { reportId } = req.params;
    
    try {
      console.log(`[REPORT] Accessing report: ${reportId}`);
      const reportCards = await storage.getAllGeneratedReportCards();
      const report = reportCards.find(r => r.id === reportId);
      
      if (!report) {
        console.log(`[REPORT] Report not found: ${reportId}`);
        return res.status(404).send(`
          <html>
            <head><title>Report Not Found</title></head>
            <body>
              <h1>Report Card Not Found</h1>
              <p>The requested report card could not be found.</p>
              <a href="javascript:window.close()">Close Window</a>
            </body>
          </html>
        `);
      }

      // Get student and assessment data
      const student = await storage.getStudent(report.studentId);
      const assessments = await storage.getStudentAssessments(report.studentId, report.term, report.session);
      const attendance = await storage.getAttendanceByStudent(report.studentId, report.term, report.session);
      
      if (!student) {
        return res.status(404).send(`
          <html>
            <head><title>Student Not Found</title></head>
            <body>
              <h1>Student Data Not Found</h1>
              <p>Could not find student data for this report.</p>
              <a href="javascript:window.close()">Close Window</a>
            </body>
          </html>
        `);
      }

      // Calculate overall average
      const totalScore = assessments.reduce((sum: number, assessment: any) => sum + Number(assessment.total || 0), 0);
      const overallAverage = assessments.length > 0 ? Math.round(totalScore / assessments.length) : 0;
      const overallGrade = calculateGrade(overallAverage);
      
      // Calculate attendance percentage
      const attendancePercentage = attendance ? Math.round((attendance.presentDays / attendance.totalDays) * 100) : 0;

      // Ensure student names are available (fallback to 'Unknown Student' if missing)
      const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
      console.log(`[REPORT] Serving report: ${studentName} - ${report.term} ${report.session}`);
      
      // Generate clean, working report card based on August 3rd patterns
      res.send(`
        <html>
          <head>
            <title>${studentName} - ${report.term} ${report.session} Report Card</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Arial', sans-serif; line-height: 1.4; background: white; color: #333; padding: 20px; }
              .report-card { max-width: 800px; margin: 0 auto; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; padding: 20px; border-bottom: 3px solid #4f46e5; }
              .header h1 { font-size: 28px; color: #4f46e5; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
              .header h2 { font-size: 20px; color: #6b7280; margin-bottom: 10px; }
              .session-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
              .info-item { margin-bottom: 10px; }
              .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
              .info-value { font-size: 16px; font-weight: 600; color: #374151; }
              .grades-section { margin: 30px 0; }
              .grades-table { width: 100%; border-collapse: collapse; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              .grades-table th { background: #4f46e5; color: white; padding: 12px 8px; text-align: center; font-weight: 600; font-size: 14px; }
              .grades-table td { padding: 10px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
              .grades-table tr:nth-child(even) { background: #f9fafb; }
              .grades-table .subject-name { text-align: left; font-weight: 500; }
              .grade-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
              .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px; }
              .summary-item { text-align: center; }
              .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
              .summary-value { font-size: 24px; font-weight: 700; color: #4f46e5; }
              .summary-badge { display: inline-block; padding: 8px 16px; border-radius: 6px; color: white; font-weight: 600; font-size: 16px; }
              .footer { margin-top: 40px; padding: 20px; border-top: 2px solid #e5e7eb; text-align: center; }
              .no-print { margin: 20px 0; text-align: center; }
              .no-print button { padding: 12px 24px; margin: 0 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
              .print-btn { background: #4f46e5; color: white; }
              .close-btn { background: #6b7280; color: white; }
              .no-print button:hover { opacity: 0.9; }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none !important; }
                .report-card { box-shadow: none; max-width: none; }
                .header h1 { font-size: 24px; }
                .grades-table { font-size: 12px; }
                .summary-value { font-size: 20px; }
              }
            </style>
          </head>
          <body>
            <div class="report-card">
              <div class="header">
                <h1>Seat of Wisdom Academy</h1>
                <h2>Student Report Card</h2>
                <div class="session-info">
                  <strong>Academic Session: ${report.session} • Term: ${report.term}</strong>
                </div>
              </div>
              
              <div class="student-info">
                <div>
                  <div class="info-item">
                    <div class="info-label">Student Name</div>
                    <div class="info-value">${studentName}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Student ID</div>
                    <div class="info-value">${student.studentId}</div>
                  </div>
                </div>
                <div>
                  <div class="info-item">
                    <div class="info-label">Class</div>
                    <div class="info-value">${report.className}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Generated On</div>
                    <div class="info-value">${formatDateWithOrdinal(new Date(report.generatedAt))}</div>
                  </div>
                </div>
              </div>

              <div class="grades-section">
                <h3 style="margin-bottom: 15px; color: #374151; font-size: 18px;">Academic Performance</h3>
                <table class="grades-table">
                  <thead>
                    <tr>
                      <th style="text-align: left;">Subject</th>
                      <th>1st CA<br><small>(20)</small></th>
                      <th>2nd CA<br><small>(20)</small></th>
                      <th>Exam<br><small>(60)</small></th>
                      <th>Total<br><small>(100)</small></th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${assessments.map((assessment: any) => {
                      const total = Number(assessment.total || 0);
                      const grade = calculateGrade(total);
                      return `
                        <tr>
                          <td class="subject-name">${assessment.subject?.name || 'Unknown Subject'}</td>
                          <td>${assessment.firstCA || '0'}</td>
                          <td>${assessment.secondCA || '0'}</td>
                          <td>${assessment.exam || '0'}</td>
                          <td style="font-weight: 600;">${total}</td>
                          <td><span class="grade-badge" style="background-color: ${grade.color === 'bg-green-500' ? '#10b981' : grade.color === 'bg-blue-500' ? '#3b82f6' : grade.color === 'bg-yellow-500' ? '#f59e0b' : grade.color === 'bg-orange-500' ? '#f97316' : '#ef4444'}">${grade.grade}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <div class="summary">
                <div class="summary-item">
                  <div class="summary-label">Overall Average</div>
                  <div class="summary-value">${overallAverage}%</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Overall Grade</div>
                  <div class="summary-badge" style="background-color: ${overallGrade.color === 'bg-green-500' ? '#10b981' : overallGrade.color === 'bg-blue-500' ? '#3b82f6' : overallGrade.color === 'bg-yellow-500' ? '#f59e0b' : overallGrade.color === 'bg-orange-500' ? '#f97316' : '#ef4444'}">${overallGrade.grade}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Attendance</div>
                  <div class="summary-value">${attendancePercentage}%</div>
                </div>
              </div>

              ${report.nextTermResumptionDate ? `
                <div class="footer">
                  <p style="font-size: 16px; color: #374151;"><strong>Next Term Resumes:</strong> ${formatDateWithOrdinal(new Date(report.nextTermResumptionDate))}</p>
                </div>
              ` : ''}
              
              <div class="no-print">
                <button class="print-btn" onclick="window.print()">Print Report Card</button>
                <button class="close-btn" onclick="window.close()">Close Window</button>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("[REPORT] Error fetching report card:", error);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error Loading Report</h1>
            <p>An error occurred while loading the report card: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/" onclick="window.close(); return false;">Close</a>
          </body>
        </html>
      `);
    }
  });

  // Serve static assets first (before other routes)
  app.use('/assets', express.static(path.join(process.cwd(), 'client/src/assets')));

  // Object storage routes
  // Endpoint for serving public assets
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint for serving private objects with ACL check
  app.get("/objects/:objectPath(*)", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint for getting upload URL for object entities
  app.post("/api/objects/upload", authenticate, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Endpoint for updating profile image after upload
  app.put("/api/students/:studentId/profile-image", authenticate, requireAdmin, async (req, res) => {
    if (!req.body.profileImageURL) {
      return res.status(400).json({ error: "profileImageURL is required" });
    }

    const userId = (req as any).user.id;
    const studentId = req.params.studentId;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.profileImageURL,
        {
          owner: userId,
          visibility: "public", // Profile images should be publicly accessible
        },
      );

      // Update student profile image in database
      const updatedStudent = await storage.updateStudentProfileImage(studentId, objectPath);
      
      res.status(200).json({
        objectPath: objectPath,
        student: updatedStudent
      });
    } catch (error) {
      console.error("Error setting profile image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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

  // Alternative endpoint for subject assignment (used by overview tab)
  app.post('/api/admin/classes/assign-subject', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, subjectId } = req.body;
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

  // Update user (admin only)
  app.put('/api/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, schoolId, isActive, password } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Prepare update data
      const updateData: any = {
        firstName,
        lastName,
        email,
        isActive
      };
      
      // Only update schoolId for sub-admin users
      if (existingUser.role === 'sub-admin' && schoolId !== undefined) {
        updateData.schoolId = schoolId;
      }
      
      // Update user profile
      const updatedUser = await storage.updateUserProfile(id, updateData);
      
      // Update password if provided
      if (password) {
        await storage.updateUserPassword(id, password);
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
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
        age,
        gender,
        profileImage,
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
        age: age ? parseInt(age) : null,
        profileImage: profileImage || null,
        gender: gender || null,
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
    } catch (error: any) {
      console.error("Create student error:", error);
      res.status(500).json({ error: error.message || "Failed to create student" });
    }
  });

  // Update student details (admin only)
  app.patch('/api/admin/students/:id', authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const user = (req as any).user;
      
      // For sub-admins, verify the student belongs to their school
      if (user.role === 'sub-admin') {
        // Get student with class information to access schoolId
        const studentResult = await db
          .select()
          .from(students)
          .leftJoin(classes, eq(students.classId, classes.id))
          .where(eq(students.id, id))
          .limit(1);
        
        const studentWithClass = studentResult[0];
        if (!studentWithClass || !studentWithClass.classes || studentWithClass.classes.schoolId !== user.schoolId) {
          return res.status(403).json({ error: 'Cannot update student from different school' });
        }
      }
      
      // Handle date conversion properly and filter out non-student fields
      const { firstName, lastName, middleName, email, ...studentOnlyData } = updateData;
      
      // Convert date string to Date object if provided
      if (studentOnlyData.dateOfBirth && typeof studentOnlyData.dateOfBirth === 'string') {
        studentOnlyData.dateOfBirth = new Date(studentOnlyData.dateOfBirth);
      }
      
      // Handle integer fields - convert empty strings to null/undefined
      if (studentOnlyData.age === '' || studentOnlyData.age === null) {
        studentOnlyData.age = undefined;
      } else if (typeof studentOnlyData.age === 'string' && studentOnlyData.age.trim() !== '') {
        studentOnlyData.age = parseInt(studentOnlyData.age, 10);
      }
      
      // Clean up other empty string fields
      Object.keys(studentOnlyData).forEach(key => {
        if (studentOnlyData[key] === '') {
          studentOnlyData[key] = undefined;
        }
      });
      
      // Update user fields if provided
      if (firstName || lastName || middleName || email) {
        const student = await storage.getStudent(id);
        if (student && student.userId) {
          // Update the user record directly in database
          await db.update(users)
            .set({
              firstName: firstName || undefined,
              lastName: lastName || undefined, 
              email: email || undefined
            })
            .where(eq(users.id, student.userId));
        }
      }
      
      // Update student fields  
      const updatedStudent = await storage.updateStudent(id, studentOnlyData);
      res.json(updatedStudent);
    } catch (error: any) {
      console.error('Error updating student:', error);
      res.status(500).json({ error: 'Failed to update student' });
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

  // Get current academic session and term
  app.get('/api/current-academic-info', async (req, res) => {
    try {
      const currentInfo = await storage.getCurrentAcademicInfo();
      res.json(currentInfo);
    } catch (error) {
      console.error("Error fetching current academic info:", error);
      res.status(500).json({ error: "Failed to fetch current academic info" });
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

  // Attendance tracking routes
  app.get("/api/admin/attendance/class/:classId", authenticate, async (req: Request, res: Response) => {
    const { classId } = req.params;
    const { term, session } = req.query;
    const user = (req as any).user;

    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view attendance" });
      }

      if (!term || !session) {
        return res.status(400).json({ error: "Term and session are required" });
      }

      const attendanceRecords = await storage.getClassAttendance(classId, term as string, session as string);
      res.json(attendanceRecords);
    } catch (error) {
      console.error("Error fetching class attendance:", error);
      res.status(500).json({ error: "Failed to fetch attendance data" });
    }
  });

  app.post("/api/admin/attendance", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can record attendance" });
      }

      const validatedData = addAttendanceSchema.parse(req.body);
      const attendance = await storage.upsertAttendance(validatedData);
      
      res.json(attendance);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      }
      console.error("Error recording attendance:", error);
      res.status(500).json({ error: "Failed to record attendance" });
    }
  });

  app.get("/api/admin/attendance/student/:studentId", authenticate, async (req: Request, res: Response) => {
    const { studentId } = req.params;
    const { term, session } = req.query;
    const user = (req as any).user;

    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view attendance" });
      }

      const attendanceRecords = await storage.getStudentAttendance(studentId, term as string, session as string);
      res.json(attendanceRecords);
    } catch (error) {
      console.error("Error fetching student attendance:", error);
      res.status(500).json({ error: "Failed to fetch attendance data" });
    }
  });

  // Report Card Management routes
  app.get("/api/admin/generated-reports", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { schoolId } = req.query;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view generated reports" });
      }

      const allReportCards = await storage.getAllGeneratedReportCards();
      
      // Filter report cards by school
      let filteredReportCards = allReportCards;
      
      if (user.role === "sub-admin") {
        // Sub-admins can only see reports from their assigned school
        const userSchoolId = user.schoolId;
        if (userSchoolId) {
          // Get all classes for the user's school and filter by those class IDs
          const allClasses = await storage.getAllClasses();
          const schoolClasses = allClasses.filter(cls => cls.schoolId === userSchoolId);
          const schoolClassIds = schoolClasses.map(cls => cls.id);
          filteredReportCards = allReportCards.filter(report => schoolClassIds.includes(report.classId));
        }
      } else if (user.role === "admin" && schoolId) {
        // Main admin with specific school selected
        const allClasses = await storage.getAllClasses();
        const schoolClasses = allClasses.filter(cls => cls.schoolId === schoolId);
        const schoolClassIds = schoolClasses.map(cls => cls.id);
        filteredReportCards = allReportCards.filter(report => schoolClassIds.includes(report.classId));
      }
      // If admin with no schoolId specified, show all reports

      console.log(`[REPORTS] User ${user.role} requested reports, showing ${filteredReportCards.length} reports`);
      res.json(filteredReportCards);
    } catch (error) {
      console.error("Error fetching generated report cards:", error);
      res.status(500).json({ error: "Failed to fetch report cards" });
    }
  });

  app.get("/api/admin/generated-reports/student/:studentId", authenticate, async (req: Request, res: Response) => {
    const { studentId } = req.params;
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view student reports" });
      }

      const reportCards = await storage.getGeneratedReportCardsByStudent(studentId);
      res.json(reportCards);
    } catch (error) {
      console.error("Error fetching student report cards:", error);
      res.status(500).json({ error: "Failed to fetch student report cards" });
    }
  });

  app.post("/api/admin/validate-report-data", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can validate report data" });
      }

      const { studentId, classId, term, session } = req.body;
      
      if (!studentId || !classId || !term || !session) {
        return res.status(400).json({ error: "Missing required fields: studentId, classId, term, session" });
      }

      const validation = await storage.validateReportCardData(studentId, classId, term, session);
      
      // Map validation result to frontend format
      const status = validation.hasAllScores && validation.hasAttendance ? "complete" : 
                    validation.hasAllScores || validation.hasAttendance ? "partial" : "incomplete";
      
      let message = "";
      if (!validation.hasAllScores && !validation.hasAttendance) {
        message = validation.missingSubjects.length > 0 ? 
          `Missing subjects: ${validation.missingSubjects.join(", ")} and attendance data` :
          "Missing scores and attendance data";
      } else if (!validation.hasAllScores) {
        message = validation.missingSubjects.length > 0 ? 
          `Missing subjects: ${validation.missingSubjects.join(", ")}` :
          "Missing some scores";
      } else if (!validation.hasAttendance) {
        message = "Missing attendance data";
      } else {
        message = "All data complete";
      }

      console.log(`[VALIDATION] Student ${studentId}: ${status} - ${message}`);

      res.json({
        studentId,
        status,
        message,
        missingSubjects: validation.missingSubjects,
        hasAttendance: validation.hasAttendance,
        hasAllScores: validation.hasAllScores
      });
    } catch (error) {
      console.error("Error validating report card data:", error);
      res.status(500).json({ error: "Failed to validate report card data" });
    }
  });

  app.post("/api/admin/generated-reports", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can create report records" });
      }

      const { studentId, classId, term, session, studentName, className, totalScore, averageScore, attendancePercentage, nextTermResumptionDate } = req.body;
      
      if (!studentId || !classId || !term || !session) {
        return res.status(400).json({ error: "Missing required fields: studentId, classId, term, session" });
      }

      // Check for duplicate report card
      const existingReports = await storage.getAllGeneratedReportCards();
      const duplicateReport = existingReports.find(report => 
        report.studentId === studentId && 
        report.classId === classId && 
        report.term === term && 
        report.session === session
      );
      
      if (duplicateReport) {
        return res.status(409).json({ error: "Report card already exists for this student, term, and session" });
      }

      const reportCardData = {
        studentId,
        classId,
        term,
        session,
        studentName,
        className,
        totalScore: totalScore?.toString(),
        averageScore: averageScore?.toString(),
        attendancePercentage: attendancePercentage?.toString(),
        nextTermResumptionDate: nextTermResumptionDate ? new Date(nextTermResumptionDate) : null,
        generatedBy: user.id
      };

      const reportCard = await storage.createGeneratedReportCard(reportCardData);
      res.json(reportCard);
    } catch (error) {
      console.error("Error creating report card record:", error);
      res.status(500).json({ error: "Failed to create report card record" });
    }
  });

  app.delete("/api/admin/generated-reports/:reportId", authenticate, async (req: Request, res: Response) => {
    const { reportId } = req.params;
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can delete report cards" });
      }

      await storage.deleteGeneratedReportCard(reportId);
      res.json({ success: true, message: "Report card deleted successfully" });
    } catch (error) {
      console.error("Error deleting report card:", error);
      res.status(500).json({ error: "Failed to delete report card" });
    }
  });

  // Get students by class for report validation
  app.get("/api/admin/students/class/:classId", authenticate, async (req: Request, res: Response) => {
    const { classId } = req.params;
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view students" });
      }

      const students = await storage.getStudentsByClass(classId);
      res.json(students);
    } catch (error) {
      console.error("Error fetching students by class:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}