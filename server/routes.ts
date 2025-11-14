import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService } from "./email";
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
  insertNewsSchema,
  insertNotificationSchema,
  users,
  students,
  classes,
  assessments
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'development-jwt-secret-change-in-production' : null);

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required for production");
  process.exit(1);
}

if (process.env.NODE_ENV !== 'development' && JWT_SECRET === 'development-jwt-secret-change-in-production') {
  console.error("FATAL: Using development JWT secret in production is not allowed");
  process.exit(1);
}

// Store invalidated tokens (in production, use Redis or database)
const invalidatedTokens = new Set<string>();

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting helper
function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
}

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

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; iat?: number };
    const user = await storage.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Check if token was issued before password was last updated (session invalidation)
    if (decoded.iat && user.passwordUpdatedAt) {
      const tokenIssuedAt = decoded.iat * 1000; // Convert JWT iat (seconds) to milliseconds
      const passwordUpdatedAt = new Date(user.passwordUpdatedAt).getTime();
      
      if (tokenIssuedAt < passwordUpdatedAt) {
        return res.status(401).json({ error: "Token expired due to password change" });
      }
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

  // Firebase config endpoint (public - no auth required)
  // This provides fallback config for production builds where env vars may not be available
  app.get("/api/firebase-config", (req, res) => {
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const appId = process.env.VITE_FIREBASE_APP_ID;

    // Only return config if all required values are present
    if (!apiKey || !projectId || !appId) {
      return res.status(503).json({ 
        error: "Firebase configuration not available on server" 
      });
    }

    res.json({
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
      appId,
    });
  });

  // Sitemap endpoint (public - for Google Search Console)
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://seatofwisdomacademy.com'
        : `https://${req.get('host')}`;

      // Static public pages
      const staticPages = [
        { url: '/', changefreq: 'daily', priority: '1.0' },
        { url: '/about', changefreq: 'monthly', priority: '0.8' },
        { url: '/programs', changefreq: 'monthly', priority: '0.8' },
        { url: '/admissions', changefreq: 'monthly', priority: '0.8' },
        { url: '/contact', changefreq: 'monthly', priority: '0.7' },
        { url: '/news', changefreq: 'daily', priority: '0.9' },
        { url: '/login', changefreq: 'yearly', priority: '0.3' },
      ];

      // Fetch all published news articles
      const newsArticles = await storage.getAllPublishedNews();
      
      // Build sitemap XML
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

      // Add static pages
      for (const page of staticPages) {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}${page.url}</loc>\n`;
        sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
        sitemap += `    <priority>${page.priority}</priority>\n`;
        sitemap += '  </url>\n';
      }

      // Add news articles with images
      for (const article of newsArticles) {
        // Since we filter for published news only, publishedAt is guaranteed to be non-null
        const lastModDate = article.publishedAt ? new Date(article.publishedAt) : new Date(article.createdAt);
        
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}/news/${article.id}</loc>\n`;
        sitemap += `    <lastmod>${lastModDate.toISOString()}</lastmod>\n`;
        sitemap += '    <changefreq>weekly</changefreq>\n';
        sitemap += '    <priority>0.7</priority>\n';
        
        // Add image if available
        if (article.imageUrl) {
          sitemap += '    <image:image>\n';
          sitemap += `      <image:loc>${baseUrl}/public-objects/${article.imageUrl}</image:loc>\n`;
          sitemap += `      <image:title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</image:title>\n`;
          sitemap += '    </image:image>\n';
        }
        
        sitemap += '  </url>\n';
      }

      sitemap += '</urlset>';

      res.header('Content-Type', 'application/xml');
      res.send(sitemap);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send('Error generating sitemap');
    }
  });

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
      
      // Check if it's a student ID format (SOWA/####)
      if (email.includes('/')) {
        user = await storage.authenticateUserByStudentId(email, password);
      } else {
        // It's an email - convert to lowercase for case-insensitive lookup
        const normalizedEmail = email.toLowerCase();
        user = await storage.authenticateUser(normalizedEmail, password);
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
    res.redirect('/portal/login');
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

  // Admin routes - User management (main admin only)
  app.post('/api/admin/users', authenticate, requireMainAdmin, async (req, res) => {
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
  app.get('/api/admin/academic-sessions', authenticate, requireAdmin, async (req, res) => {
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

  app.get('/api/admin/academic-terms', authenticate, requireAdmin, async (req, res) => {
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

  // Advance term automatically: First → Second → Third → First (next session)
  app.post('/api/admin/advance-term', authenticate, requireAdmin, async (req, res) => {
    try {
      const result = await storage.advanceAcademicTerm();
      res.json(result);
    } catch (error) {
      console.error("Advance term error:", error);
      res.status(400).json({ error: "Failed to advance academic term" });
    }
  });

  // Initialize academic calendar if none exists
  app.post('/api/admin/initialize-academic-calendar', authenticate, requireAdmin, async (req, res) => {
    try {
      const result = await storage.initializeAcademicCalendar();
      res.json(result);
    } catch (error) {
      console.error("Initialize academic calendar error:", error);
      res.status(400).json({ error: "Failed to initialize academic calendar" });
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

  app.delete('/api/admin/classes/:classId', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      await storage.deleteClass(classId);
      res.json({ message: "Class deleted successfully" });
    } catch (error) {
      console.error("Delete class error:", error);
      res.status(400).json({ error: "Failed to delete class" });
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

  // Users routes (main admin only - sub-admins cannot access user management)
  app.get('/api/admin/users', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const adminOnly = req.query.adminOnly === 'true';
      const users = await storage.getAllUsers(adminOnly);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user (main admin only)
  app.put('/api/admin/users/:id', authenticate, requireMainAdmin, async (req, res) => {
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

  // PATCH user (main admin only) - for partial updates like password changes
  app.patch('/api/admin/users/:id', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password, ...otherData } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update password if provided
      if (password) {
        await storage.updateUserPassword(id, password);
        res.json({ message: 'Password updated successfully' });
      } else if (Object.keys(otherData).length > 0) {
        // Handle other profile updates
        const updatedUser = await storage.updateUserProfile(id, otherData);
        res.json(updatedUser);
      } else {
        res.status(400).json({ error: 'No data provided for update' });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user (main admin only)
  app.delete('/api/admin/users/:id', authenticate, requireMainAdmin, async (req, res) => {
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

  app.post('/api/admin/users', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      res.json(newUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  // Create sub-admin (with school assignment) - main admin only
  app.post('/api/admin/create-sub-admin', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { firstName, lastName, email, password, schoolId } = req.body;
      
      if (!firstName || !lastName || !email || !password || !schoolId) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const userData = {
        firstName,
        lastName,
        email,
        password,
        role: 'sub-admin' as const,
        schoolId,
        isActive: true
      };

      const newUser = await storage.createUser(userData);
      res.json(newUser);
    } catch (error) {
      console.error("Create sub-admin error:", error);
      res.status(400).json({ error: "Failed to create sub-admin" });
    }
  });

  // Create main admin (no school assignment) - main admin only
  app.post('/api/admin/create-main-admin', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const userData = {
        firstName,
        lastName,
        email,
        password,
        role: 'admin' as const,
        schoolId: null, // Main admins have access to all schools
        isActive: true
      };

      const newUser = await storage.createUser(userData);
      res.json(newUser);
    } catch (error) {
      console.error("Create main admin error:", error);
      res.status(400).json({ error: "Failed to create main admin" });
    }
  });

  // === PASSWORD MANAGEMENT ROUTES ===
  
  // Change user password (main admin only)
  app.patch('/api/admin/users/:id/password', authenticate, requireMainAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      
      // Check if user exists
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update password
      await storage.updateUserPassword(id, newPassword);
      
      // Log the password change for audit
      console.log(`Password changed for user ${user.email} by admin ${req.user?.email}`);
      
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  // Request password reset
  app.post('/api/auth/request-password-reset', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      // Always return success to avoid user enumeration
      res.json({ message: 'If an account with that email exists, you will receive a password reset link.' });
      
      // Check if user exists (but don't reveal this to the client)
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return; // Silent fail to prevent user enumeration
      }
      
      // Generate reset token
      const resetToken = await storage.createPasswordResetToken(user.id);
      
      // Send password reset email
      await emailService.sendPasswordResetEmail(email, resetToken);
      
      console.log(`Password reset email sent to ${email}`);
      
    } catch (error) {
      console.error('Error requesting password reset:', error);
      // Still return success to avoid revealing errors
      res.json({ message: 'If an account with that email exists, you will receive a password reset link.' });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      
      // Verify and use the reset token
      const userId = await storage.verifyAndUsePasswordResetToken(token);
      if (!userId) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Update the password
      await storage.updateUserPassword(userId, newPassword);
      
      console.log(`Password reset completed for user ID: ${userId}`);
      
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
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

  // Principal signature upload route
  app.post('/api/admin/schools/signature', authenticate, requireAdmin, async (req, res) => {
    try {
      const { schoolId, signatureUrl } = req.body;
      
      if (!schoolId || !signatureUrl) {
        return res.status(400).json({ error: "School ID and signature URL are required" });
      }

      const updatedSchool = await storage.updateSchoolPrincipalSignature(schoolId, signatureUrl);
      res.json(updatedSchool);
    } catch (error) {
      console.error("Signature upload error:", error);
      res.status(400).json({ error: "Failed to upload signature" });
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
        parentWhatsApp,
        address,
        schoolId: requestSchoolId
      } = req.body;
      
      // Required fields validation (email is now optional)
      if (!firstName || !lastName || !password || !classId || !parentWhatsApp) {
        return res.status(400).json({ error: "Required fields: firstName, lastName, password, classId, parentWhatsApp" });
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

      // Student ID will be auto-generated by createStudent with gap-filling logic
      // Generate placeholder email (will update after student ID is generated)
      const tempEmail = email || `temp${Date.now()}@student.local`;

      // First create the user account with temp email
      const userData = insertUserSchema.parse({
        firstName,
        lastName,
        email: tempEmail,
        password,
        role: 'student',
        schoolId: schoolId
      });
      
      const newUser = await storage.createUser(userData);
      
      // Then create the student record - studentId will be auto-generated with gap-filling
      const studentData = insertStudentSchema.parse({
        userId: newUser.id,
        classId,
        // Don't pass studentId - let createStudent auto-generate it with gap-filling logic
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        age: age ? parseInt(age) : null,
        profileImage: profileImage || null,
        gender: gender || null,
        parentWhatsapp: parentWhatsApp,
        address: address || ''
      });
      
      const student = await storage.createStudent(studentData);
      
      // Update email if it was a placeholder
      if (!email) {
        const finalEmail = `${student.studentId.replace('/', '')}@student.local`;
        await storage.updateUserProfile(newUser.id, { email: finalEmail });
        newUser.email = finalEmail;
      }
      
      res.json({ 
        message: "Student created successfully",
        user: newUser, 
        student,
        studentId: student.studentId
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
      const { firstName, lastName, middleName, email, isActive, ...studentOnlyData } = updateData;
      
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
      if (firstName !== undefined || lastName !== undefined || middleName !== undefined || email !== undefined || isActive !== undefined) {
        const student = await storage.getStudent(id);
        if (student && student.userId) {
          const userUpdateData: any = {};
          if (firstName !== undefined) userUpdateData.firstName = firstName;
          if (lastName !== undefined) userUpdateData.lastName = lastName;
          if (middleName !== undefined) userUpdateData.middleName = middleName;
          if (email !== undefined) userUpdateData.email = email;
          if (isActive !== undefined) userUpdateData.isActive = isActive;
          
          // Update the user record directly in database
          await db.update(users)
            .set(userUpdateData)
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

  // Download Excel template for batch student upload
  app.get('/api/admin/students/batch-template/:classId', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      
      // Get class info
      const classInfo = await storage.getClassById(classId);
      if (!classInfo) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Create Excel template with columns
      const templateData = [
        {
          'First Name': 'John',
          'Last Name': 'Doe',
          'Middle Name': 'Michael',
          'Email (Optional)': 'john.doe@example.com',
          'Date of Birth (DD/MM/YYYY)': '15/01/2010',
          'Gender (M/F)': 'M',
          'Parent WhatsApp': '08012345678',
          'Address': '123 Main Street, City'
        }
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 15 }, // Middle Name
        { wch: 25 }, // Email
        { wch: 25 }, // Date of Birth
        { wch: 15 }, // Gender
        { wch: 20 }, // Parent WhatsApp
        { wch: 30 }  // Address
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Students');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="batch_students_template_${classInfo.name.replace(/\s+/g, '_')}.xlsx"`,
        'Content-Length': buffer.length
      });

      res.send(buffer);

    } catch (error) {
      console.error("Batch template download error:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Bulk student upload from Excel
  app.post('/api/admin/students/batch-upload', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
    try {
      const { classId } = req.body;
      
      if (!classId) {
        return res.status(400).json({ error: "Class ID is required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Excel file is required" });
      }

      const user = (req as any).user;
      
      // Get class info to determine school
      const classInfo = await storage.getClassById(classId);
      if (!classInfo) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Sub-admin can only upload to their school
      if (user.role === 'sub-admin' && classInfo.schoolId !== user.schoolId) {
        return res.status(403).json({ error: "Access denied to this school's data" });
      }

      const schoolId = classInfo.schoolId!;

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        return res.status(400).json({ error: "Excel file is empty" });
      }

      const results = {
        successful: [] as any[],
        failed: [] as any[]
      };

      // Process each row
      for (const row of data as any[]) {
        try {
          const firstName = row['First Name']?.toString().trim();
          const lastName = row['Last Name']?.toString().trim();
          const middleName = row['Middle Name']?.toString().trim() || '';
          const emailInput = row['Email (Optional)']?.toString().trim() || row['Email']?.toString().trim(); // Support both column names
          const dateOfBirthStr = row['Date of Birth (DD/MM/YYYY)']?.toString().trim();
          const gender = row['Gender (M/F)']?.toString().trim();
          const parentWhatsApp = row['Parent WhatsApp']?.toString().trim();
          const address = row['Address']?.toString().trim() || '';

          // Validate required fields (email is now optional)
          if (!firstName || !lastName || !parentWhatsApp) {
            results.failed.push({
              row,
              error: "Missing required fields (First Name, Last Name, Parent WhatsApp)"
            });
            continue;
          }

          // Validate names (single words only)
          if (firstName.includes(' ') || lastName.includes(' ') || (middleName && middleName.includes(' '))) {
            results.failed.push({
              row,
              error: "Names must be single words without spaces"
            });
            continue;
          }

          // Parse date of birth (DD/MM/YYYY)
          let dateOfBirth: Date | null = null;
          if (dateOfBirthStr) {
            const parts = dateOfBirthStr.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1; // Month is 0-indexed
              const year = parseInt(parts[2]);
              dateOfBirth = new Date(year, month, day);
            }
          }

          // Calculate age if date of birth is provided
          let age: number | null = null;
          if (dateOfBirth && !isNaN(dateOfBirth.getTime())) {
            const today = new Date();
            age = today.getFullYear() - dateOfBirth.getFullYear();
            const monthDiff = today.getMonth() - dateOfBirth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
              age--;
            }
          }

          // Create user with default password (using temp email for now)
          const tempEmail = emailInput || `temp_${Date.now()}_${Math.random()}@student.local`;
          const userData = insertUserSchema.parse({
            firstName,
            lastName,
            email: tempEmail,
            password: 'password@123', // Default password
            role: 'student',
            schoolId: schoolId
          });

          const newUser = await storage.createUser(userData);

          // Create student record (studentId will be auto-generated with gap-filling logic)
          const studentData = insertStudentSchema.parse({
            userId: newUser.id,
            classId,
            // studentId is NOT provided - let createStudent auto-generate with gap-filling
            dateOfBirth: dateOfBirth,
            age: age,
            profileImage: null,
            gender: gender || null,
            parentWhatsapp: parentWhatsApp,
            address: address
          });

          const student = await storage.createStudent(studentData);

          // Update user email with actual student ID if no email was provided
          if (!emailInput) {
            const actualEmail = `${student.studentId.replace('/', '')}@student.local`;
            await storage.updateUser(newUser.id, { email: actualEmail });
          }

          results.successful.push({
            studentId: student.studentId,
            name: `${firstName} ${lastName}`,
            email: emailInput || `${student.studentId.replace('/', '')}@student.local`
          });

        } catch (error: any) {
          results.failed.push({
            row,
            error: error.message || "Failed to create student"
          });
        }
      }

      res.json({
        message: `Batch upload complete. ${results.successful.length} successful, ${results.failed.length} failed.`,
        results
      });

    } catch (error: any) {
      console.error("Batch upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process batch upload" });
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
      
      if (!scores || !Array.isArray(scores)) {
        console.error("Invalid scores data:", req.body);
        return res.status(400).json({ error: "Invalid scores data - expected array" });
      }
      
      console.log(`Processing bulk score update for ${scores.length} students`);
      const results = [];
      const errors = [];
      
      for (let i = 0; i < scores.length; i++) {
        const scoreData = scores[i];
        try {
          // Validate required fields
          if (!scoreData.studentId || !scoreData.subjectId || !scoreData.classId) {
            throw new Error(`Missing required fields for score ${i}: studentId, subjectId, or classId`);
          }
          
          const total = (scoreData.firstCA || 0) + (scoreData.secondCA || 0) + (scoreData.exam || 0);
          const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
          
          const assessment = await storage.createOrUpdateAssessment({
            ...scoreData,
            total,
            grade
          });
          results.push(assessment);
          console.log(`Successfully updated score for student ${scoreData.studentId}`);
        } catch (scoreError) {
          console.error(`Error updating score for student ${scoreData.studentId}:`, scoreError);
          errors.push({
            studentId: scoreData.studentId,
            error: scoreError.message
          });
        }
      }
      
      if (errors.length > 0) {
        console.warn(`Bulk update completed with ${errors.length} errors:`, errors);
        return res.status(207).json({ 
          message: `${results.length} scores updated successfully, ${errors.length} failed`, 
          results, 
          errors 
        });
      }
      
      console.log(`Bulk score update completed successfully for ${results.length} students`);
      res.json({ message: "Scores updated successfully", results });
    } catch (error) {
      console.error("Bulk score update error:", error);
      res.status(500).json({ error: "Failed to update scores: " + error.message });
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

      const { term = "First Term", session = "2024/2025", classId } = req.query;
      const student = await storage.getStudentByUserId(user.id);
      
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      // Check if scores are published for this class/term/session
      const useClassId = classId as string || student.classId;
      const isPublished = await storage.checkIfScoresPublished(
        useClassId,
        term as string,
        session as string
      );

      if (!isPublished) {
        return res.status(403).json({ 
          error: "Scores not yet published",
          message: "Your scores for this term have not been published yet. Please check back later."
        });
      }

      const assessments = await storage.getStudentAssessments(
        student.id, 
        term as string, 
        session as string,
        classId as string | undefined
      );
      
      res.json(assessments);
    } catch (error) {
      console.error("Get student assessments error:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Get student behavioral ratings
  app.get('/api/student/behavioral-ratings', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const { term = "First Term", session = "2024/2025", classId } = req.query;
      const student = await storage.getStudentByUserId(user.id);
      
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const useClassId = classId as string || student.classId;

      // Check if scores are published for this class/term/session
      const isPublished = await storage.checkIfScoresPublished(
        useClassId,
        term as string,
        session as string
      );

      if (!isPublished) {
        return res.status(403).json({ 
          error: "Scores not yet published",
          message: "Your scores for this term have not been published yet. Please check back later."
        });
      }

      const ratings = await storage.getNonAcademicRatingByStudent(
        student.id, 
        useClassId,
        term as string, 
        session as string
      );
      
      res.json(ratings);
    } catch (error) {
      console.error("Get student behavioral ratings error:", error);
      res.status(500).json({ error: "Failed to fetch behavioral ratings" });
    }
  });

  // Get students by class (for teacher interface)
  app.get('/api/admin/students/by-class/:classId', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      const students = await storage.getStudentsByClass(classId);
      res.json(students);
    } catch (error) {
      console.error("Get students by class error:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Get assessments with filtering (for teacher interface)
  app.get('/api/admin/assessments/:classId/:term/:session', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, term, session } = req.params;
      const assessments = await storage.getAssessmentsByClassTermSession(classId, term, session);
      res.json(assessments);
    } catch (error) {
      console.error("Get assessments error:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Non-academic ratings endpoints
  app.get('/api/admin/non-academic-ratings/:classId/:term/:session', authenticate, requireAdmin, async (req, res) => {
    try {
      const { classId, term, session } = req.params;
      const ratings = await storage.getNonAcademicRatingsByClass(classId, term, session);
      res.json(ratings);
    } catch (error) {
      console.error("Get non-academic ratings error:", error);
      res.status(500).json({ error: "Failed to fetch ratings" });
    }
  });

  app.post('/api/admin/non-academic-ratings', authenticate, requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const ratingData = req.body;
      const rating = await storage.createOrUpdateNonAcademicRating({
        ...ratingData,
        ratedBy: user.id
      });
      
      res.json(rating);
    } catch (error) {
      console.error("Create/update non-academic rating error:", error);
      res.status(400).json({ error: "Failed to save rating" });
    }
  });

  // Admin/Teacher routes - Assessment management
  app.post('/api/admin/assessments', authenticate, requireAdmin, async (req, res) => {
    try {
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

  // Excel upload for bulk score updates (supports both single and multi-subject files)
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
      if (!classId || !term || !session) {
        return res.status(400).json({ 
          error: "Missing required fields: classId, term, session" 
        });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetCount = workbook.SheetNames.length;
      
      console.log(`📊 Excel file has ${sheetCount} sheet(s):`, workbook.SheetNames);

      // Detect if this is a multi-subject file (multiple sheets)
      const isMultiSubject = sheetCount > 1;
      
      let allResults = [];
      let allErrors = [];
      let sheetsProcessed = 0;

      // Get all subjects for the class to match sheet names (only for multi-subject files)
      const classSubjects = isMultiSubject ? await storage.getClassSubjects(classId) : [];
      
      // For single-sheet files, subjectId is required
      if (!isMultiSubject && !subjectId) {
        return res.status(400).json({ 
          error: "subjectId is required for single-subject uploads" 
        });
      }
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        console.log(`\n📋 Processing sheet: "${sheetName}"`);
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Check if this sheet has title rows (Class:, Subject:, etc.)
        // Title format has 4 title rows + 1 blank + 1 header row = starts at row 6 (index 5)
        const firstCell = worksheet['A1'];
        const hasTitleRows = firstCell && 
          (String(firstCell.v).toLowerCase().includes('class') || 
           String(firstCell.v).toLowerCase().includes('subject'));
        
        // If title rows exist, skip first 5 rows and use row 6 as header
        const data = hasTitleRows 
          ? XLSX.utils.sheet_to_json(worksheet, { range: 5 }) // Start from row 6 (0-indexed)
          : XLSX.utils.sheet_to_json(worksheet); // Use default (row 1 as header)

        if (data.length === 0) {
          console.log(`⚠️  Sheet "${sheetName}" is empty, skipping...`);
          continue;
        }

        // Determine which subject to use for this sheet
        let currentSubjectId = subjectId; // Default to provided subjectId
        
        if (isMultiSubject) {
          // Try to match sheet name to subject name
          const matchingSubject = classSubjects.find(
            s => s.name.toLowerCase().trim() === sheetName.toLowerCase().trim()
          );
          
          if (!matchingSubject) {
            const warning = `Sheet "${sheetName}": No matching subject found, skipping this sheet`;
            allErrors.push(warning);
            console.log(`⚠️  ${warning}`);
            continue;
          }
          
          currentSubjectId = matchingSubject.id;
          console.log(`✅ Matched sheet "${sheetName}" to subject "${matchingSubject.name}" (${currentSubjectId})`);
        }

        // Process each row in the sheet
        const sheetResults = [];
        const sheetErrors = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i] as any;
          try {
            // Map Excel columns to our data structure
            const studentId = row['Student ID'] || row['student_id'] || row['studentId'];
            const firstCAValue = row['First CA'] || row['first_ca'] || row['firstCA'];
            const secondCAValue = row['Second CA'] || row['second_ca'] || row['secondCA'];
            const examValue = row['Exam'] || row['exam'];

            if (!studentId) {
              sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: Missing student ID`);
              continue;
            }

            // Find student by studentId (SOWA/0001 format)
            const student = await storage.getStudentByStudentId(studentId);
            if (!student) {
              sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: Student ${studentId} not found`);
              continue;
            }

            // Get existing assessment to preserve scores when cells are empty
            const existingAssessments = await db
              .select()
              .from(assessments)
              .where(
                and(
                  eq(assessments.studentId, student.id),
                  eq(assessments.subjectId, currentSubjectId),
                  eq(assessments.classId, classId),
                  eq(assessments.term, term),
                  eq(assessments.session, session)
                )
              );
            
            const existing = existingAssessments[0];
            
            // Only update scores if values are provided (not empty/null/undefined)
            // Empty cells preserve existing values
            const firstCA = (firstCAValue !== '' && firstCAValue !== null && firstCAValue !== undefined) 
              ? parseFloat(String(firstCAValue)) 
              : (existing?.firstCA ?? 0);
            const secondCA = (secondCAValue !== '' && secondCAValue !== null && secondCAValue !== undefined) 
              ? parseFloat(String(secondCAValue)) 
              : (existing?.secondCA ?? 0);
            const exam = (examValue !== '' && examValue !== null && examValue !== undefined) 
              ? parseFloat(String(examValue)) 
              : (existing?.exam ?? 0);

            // Validate scores only if they're being updated
            if (firstCAValue !== '' && firstCAValue !== null && firstCAValue !== undefined) {
              if (firstCA < 0 || firstCA > 20) {
                sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: First CA must be between 0-20`);
                continue;
              }
            }
            if (secondCAValue !== '' && secondCAValue !== null && secondCAValue !== undefined) {
              if (secondCA < 0 || secondCA > 20) {
                sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: Second CA must be between 0-20`);
                continue;
              }
            }
            if (examValue !== '' && examValue !== null && examValue !== undefined) {
              if (exam < 0 || exam > 60) {
                sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: Exam must be between 0-60`);
                continue;
              }
            }

            // Create or update assessment
            await storage.createOrUpdateAssessment({
              studentId: student.id,
              subjectId: currentSubjectId,
              classId,
              term,
              session,
              firstCA,
              secondCA,
              exam
            });

            sheetResults.push({
              sheet: sheetName,
              studentId,
              studentName: `${student.user.firstName} ${student.user.lastName}`,
              firstCA,
              secondCA,
              exam,
              total: firstCA + secondCA + exam,
              status: 'success'
            });

          } catch (error) {
            console.error(`Error processing row ${i + 2} in sheet "${sheetName}":`, error);
            sheetErrors.push(`Sheet "${sheetName}", Row ${i + 2}: ${(error as Error).message || 'Processing error'}`);
          }
        }

        allResults.push(...sheetResults);
        allErrors.push(...sheetErrors);
        sheetsProcessed++;
        
        console.log(`✅ Sheet "${sheetName}": ${sheetResults.length} students processed, ${sheetErrors.length} errors`);
      }

      const message = isMultiSubject 
        ? `Processed ${sheetsProcessed} subject(s), ${allResults.length} student scores uploaded`
        : `Processed ${allResults.length} students successfully`;

      res.json({
        message,
        isMultiSubject,
        sheetsProcessed,
        successCount: allResults.length,
        errorCount: allErrors.length,
        results: allResults,
        errors: allErrors
      });

    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ error: "Failed to process Excel file" });
    }
  });

  // Download Excel template for bulk score upload (legacy - kept for backwards compatibility)
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

  // Download single subject Excel template with class-subject naming
  app.get('/api/assessments/template-single/:classId/:subjectId', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { classId, subjectId } = req.params;
      
      console.log(`📥 Single template request for class: ${classId}, subject: ${subjectId}`);
      
      // Get class info for filename
      const classInfo = await storage.getClassById(classId);
      console.log(`📚 Class info:`, classInfo);
      
      // Get subject info from all subjects
      const allSubjects = await storage.getAllSubjects();
      const subjectInfo = allSubjects.find(s => s.id === subjectId);
      console.log(`📖 Subject info:`, subjectInfo);
      
      if (!classInfo || !subjectInfo) {
        console.error(`❌ Not found - Class: ${!!classInfo}, Subject: ${!!subjectInfo}`);
        return res.status(404).json({ error: "Class or subject not found" });
      }
      
      // Get students from the class
      const studentsInClass = await storage.getStudentsByClass(classId);
      console.log(`👥 Students count: ${studentsInClass.length}`);
      
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

      XLSX.utils.book_append_sheet(wb, ws, subjectInfo.name);

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Create filename: Subject-Class.xlsx (e.g., Mathematics-JSS1.xlsx)
      const filename = `${subjectInfo.name.replace(/\s+/g, '-')}-${classInfo.name.replace(/\s+/g, '-')}.xlsx`;

      // Set headers for download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length
      });

      res.send(buffer);

    } catch (error) {
      console.error("❌ Single subject template download error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: "Failed to generate template", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Download single subject Excel template WITH EXISTING SCORES pre-filled
  app.get('/api/assessments/template-single-with-scores/:classId/:subjectId/:term/:session', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { classId, subjectId, term, session } = req.params;
      
      // Get class info for filename
      const classInfo = await storage.getClassById(classId);
      
      // Get subject info
      const allSubjects = await storage.getAllSubjects();
      const subjectInfo = allSubjects.find(s => s.id === subjectId);
      
      if (!classInfo || !subjectInfo) {
        return res.status(404).json({ error: "Class or subject not found" });
      }
      
      // Get students from the class
      const studentsInClass = await storage.getStudentsByClass(classId);
      
      // Get existing scores for this class, subject, term, and session
      const existingAssessments = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.classId, classId),
            eq(assessments.subjectId, subjectId),
            eq(assessments.term, term),
            eq(assessments.session, session)
          )
        );
      
      // Create a map of studentId to assessment scores
      const scoresMap = new Map();
      existingAssessments.forEach(assessment => {
        scoresMap.set(assessment.studentId, {
          firstCA: assessment.firstCA ?? '',
          secondCA: assessment.secondCA ?? '',
          exam: assessment.exam ?? ''
        });
      });
      
      // Create Excel template with student IDs and existing scores
      const templateData = studentsInClass.map(student => {
        const scores = scoresMap.get(student.id) || { firstCA: '', secondCA: '', exam: '' };
        return {
          'Student ID': student.studentId,
          'Student Name': `${student.user.firstName} ${student.user.lastName}`,
          'First CA': scores.firstCA,
          'Second CA': scores.secondCA,
          'Exam': scores.exam
        };
      });

      // Create workbook with title section
      const wb = XLSX.utils.book_new();
      
      // Build sheet data with title rows
      const sheetData: any[] = [
        ['Class:', classInfo.name],
        ['Subject:', subjectInfo.name],
        ['Term:', term],
        ['Session:', session],
        [], // Blank row
        ['Student ID', 'Student Name', 'First CA', 'Second CA', 'Exam'] // Column headers
      ];
      
      // Add student data rows
      templateData.forEach(row => {
        sheetData.push([
          row['Student ID'],
          row['Student Name'],
          row['First CA'],
          row['Second CA'],
          row['Exam']
        ]);
      });
      
      // Create worksheet from array of arrays
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Set column widths
      ws['!cols'] = [
        { width: 15 }, // Student ID
        { width: 25 }, // Student Name
        { width: 12 }, // First CA
        { width: 12 }, // Second CA
        { width: 12 }  // Exam
      ];

      // Create descriptive sheet name (max 31 chars for Excel)
      const sheetName = `${subjectInfo.name} - ${term}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Create filename with existing scores indicator
      const filename = `${subjectInfo.name.replace(/\s+/g, '-')}-${classInfo.name.replace(/\s+/g, '-')}-with-scores.xlsx`;

      // Set headers for download
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length
      });

      res.send(buffer);

    } catch (error) {
      console.error("❌ Template with scores download error:", error);
      res.status(500).json({ error: "Failed to generate template with scores" });
    }
  });

  // BRAND NEW: Bulletproof bulk template download - deduplicates by NAME
  app.get('/api/assessments/download-bulk/:classId', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'sub-admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { classId } = req.params;
      
      const classInfo = await storage.getClassById(classId);
      if (!classInfo) {
        return res.status(404).json({ error: "Class not found" });
      }
      
      const studentsInClass = await storage.getStudentsByClass(classId);
      if (studentsInClass.length === 0) {
        return res.status(404).json({ error: "No students in this class" });
      }
      
      // Get subjects and deduplicate by NAME (not ID) for Excel compatibility
      const allSubjects = await storage.getClassSubjects(classId);
      const nameMap = new Map<string, typeof allSubjects[0]>();
      allSubjects.forEach(subject => {
        if (!nameMap.has(subject.name)) {
          nameMap.set(subject.name, subject);
        }
      });
      const uniqueSubjects = Array.from(nameMap.values());
      
      if (uniqueSubjects.length === 0) {
        return res.status(404).json({ error: "No subjects assigned to this class" });
      }
      
      const workbook = XLSX.utils.book_new();
      
      for (const subject of uniqueSubjects) {
        const studentRows = studentsInClass.map(student => ({
          'Student ID': student.studentId,
          'Student Name': `${student.user.firstName} ${student.user.lastName}`,
          'First CA': '',
          'Second CA': '',
          'Exam': ''
        }));

        const sheet = XLSX.utils.json_to_sheet(studentRows);
        sheet['!cols'] = [
          { width: 15 },
          { width: 25 },
          { width: 12 },
          { width: 12 },
          { width: 12 }
        ];

        // Truncate to 31 chars for Excel
        const sheetName = subject.name.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `${classInfo.name.replace(/\s+/g, '-')}-Bulk-Template.xlsx`;

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length
      });

      res.send(excelBuffer);

    } catch (error) {
      console.error("Bulk template error:", error);
      res.status(500).json({ 
        error: "Download failed", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // OLD endpoint - keep for backwards compatibility  
  app.get('/api/assessments/template-multi/:classId', authenticate, async (req, res) => {
    // Redirect to new bulletproof endpoint
    const { classId } = req.params;
    return res.redirect(`/api/assessments/download-bulk/${classId}`);
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
      const logoUrl = logoSetting?.value || "/attached_assets/academy-logo.png"; // Default fallback logo
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
      const logoUrl = logoSetting?.value || "/attached_assets/academy-logo.png"; // Default fallback logo
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
      const classId = req.query.classId as string;
      
      const studentFees = await storage.getStudentFees(student.id, term, session, classId);
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
      const classId = req.query.classId as string;
      
      const payments = await storage.getPayments(student.id, undefined, undefined, term, session, classId);
      res.json(payments);
    } catch (error) {
      console.error("Get student payments error:", error);
      res.status(500).json({ error: "Failed to fetch student payments" });
    }
  });

  // Get academic sessions for students (read-only)
  app.get('/api/student/academic-sessions', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only students can access this endpoint
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }
      
      const sessions = await storage.getAcademicSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Get academic sessions error:", error);
      res.status(500).json({ error: "Failed to fetch academic sessions" });
    }
  });

  // Get all classes student has been enrolled in (current + historical)
  app.get('/api/student/classes', authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only students can access this endpoint
      if (user.role !== 'student') {
        return res.status(403).json({ error: "Student access required" });
      }

      const student = await storage.getStudentByUserId(user.id);
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }
      
      const classes = await storage.getStudentEnrolledClasses(student.id);
      res.json(classes);
    } catch (error) {
      console.error("Get student classes error:", error);
      res.status(500).json({ error: "Failed to fetch student classes" });
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
    
    try {
      if (user.role !== "admin" && user.role !== "sub-admin") {
        return res.status(403).json({ error: "Only admins and sub-admins can view generated reports" });
      }

      const reportCards = await storage.getAllGeneratedReportCards();
      res.json(reportCards);
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
        hasAttendance: validation.hasAttendance
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

      const { studentId, classId, term, session, studentName, className, totalScore, averageScore, attendancePercentage } = req.body;
      
      if (!studentId || !classId || !term || !session) {
        return res.status(400).json({ error: "Missing required fields: studentId, classId, term, session" });
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

  // ==================== NEWS ROUTES ====================
  
  // Upload news image (main admin only)
  app.post("/api/upload/news-image", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const objectStorageService = new ObjectStorageService();
    
    try {
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only main admins can upload news images" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL for news image:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });
  
  // Create news (main admin only)
  app.post("/api/news", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const objectStorageService = new ObjectStorageService();
    
    try {
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only main admins can create news" });
      }

      // Validate request body using Zod schema
      const validatedData = insertNewsSchema.parse({
        ...req.body,
        authorId: user.id
      });

      // If there's an image URL, make it public
      if (validatedData.imageUrl) {
        try {
          const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
            validatedData.imageUrl,
            {
              owner: user.id,
              visibility: "public"
            }
          );
          validatedData.imageUrl = normalizedPath;
        } catch (error) {
          console.error("Error setting image ACL policy:", error);
          // Continue even if ACL setting fails - the image might still be accessible
        }
      }

      const newsItem = await storage.createNews(validatedData);
      res.json(newsItem);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid news data", details: error.errors });
      }
      console.error("Error creating news:", error);
      res.status(500).json({ error: "Failed to create news" });
    }
  });

  // Get all news (public route - no authentication required)
  app.get("/api/news", async (req: Request, res: Response) => {
    const objectStorageService = new ObjectStorageService();
    
    try {
      const newsItems = await storage.getAllNews();
      
      // Generate signed URLs for images
      const newsWithSignedUrls = await Promise.all(
        newsItems.map(async (item) => {
          if (item.imageUrl) {
            try {
              // Normalize the URL first (converts GCS URLs to /objects/... format)
              const normalizedPath = objectStorageService.normalizeObjectEntityPath(item.imageUrl);
              
              // If it's an object entity path, generate a signed URL
              if (normalizedPath.startsWith("/objects/")) {
                const signedUrl = await objectStorageService.getSignedUrlForObjectEntity(normalizedPath, 3600);
                return { ...item, imageUrl: signedUrl };
              }
            } catch (error) {
              console.error(`Error generating signed URL for ${item.imageUrl}:`, error);
            }
          }
          return item;
        })
      );
      
      res.json(newsWithSignedUrls);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // Delete news (main admin only)
  app.delete("/api/news/:id", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    
    try {
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only main admins can delete news" });
      }

      await storage.deleteNews(id);
      res.json({ success: true, message: "News deleted successfully" });
    } catch (error) {
      console.error("Error deleting news:", error);
      res.status(500).json({ error: "Failed to delete news" });
    }
  });

  // ==================== NOTIFICATION ROUTES ====================
  
  // Create notification for all students (main admin only)
  app.post("/api/notifications", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    try {
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Only main admins can send notifications" });
      }

      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Send to all students across all schools (main admin privilege)
      const notifications = await storage.createNotificationForAllStudents(message, undefined);
      res.json({ 
        success: true, 
        message: `Notification sent to ${notifications.length} students`,
        count: notifications.length 
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Get user's notifications (student only)
  app.get("/api/notifications", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    try {
      const notifications = await storage.getNotificationsByUser(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    try {
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    
    try {
      const notification = await storage.markNotificationAsRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Publish scores for a class/term/session (admin only)
  app.post("/api/admin/publish-scores", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    // Only main admins can publish scores
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can publish scores" });
    }

    const { classId, term, session } = req.body;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: "Missing required fields: classId, term, session" });
    }

    try {
      await storage.publishScores(classId, term, session, user.id);
      res.json({ success: true, message: "Scores published successfully" });
    } catch (error) {
      console.error("Error publishing scores:", error);
      res.status(500).json({ error: "Failed to publish scores" });
    }
  });

  // Unpublish scores for a class/term/session (admin only)
  app.post("/api/admin/unpublish-scores", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    // Only main admins can unpublish scores
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can unpublish scores" });
    }

    const { classId, term, session } = req.body;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: "Missing required fields: classId, term, session" });
    }

    try {
      await storage.unpublishScores(classId, term, session);
      res.json({ success: true, message: "Scores unpublished successfully" });
    } catch (error) {
      console.error("Error unpublishing scores:", error);
      res.status(500).json({ error: "Failed to unpublish scores" });
    }
  });

  // Check if scores are published for a class/term/session
  app.get("/api/scores/published-status", authenticate, async (req: Request, res: Response) => {
    const { classId, term, session } = req.query;

    if (!classId || !term || !session) {
      return res.status(400).json({ error: "Missing required query parameters: classId, term, session" });
    }

    try {
      const isPublished = await storage.checkIfScoresPublished(
        classId as string, 
        term as string, 
        session as string
      );
      res.json({ published: isPublished });
    } catch (error) {
      console.error("Error checking publication status:", error);
      res.status(500).json({ error: "Failed to check publication status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}