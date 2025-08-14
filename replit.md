# Seat of Wisdom Academy

## Overview

A comprehensive multi-branch academy management system for **Seat of Wisdom Academy** built with React (frontend) and Express (backend) featuring complete student score tracking, administrative controls, and Firebase database integration. The application supports 4 school branches (School 1, School 2, School 3, School 4) with role-based access for admin (all schools), sub-admin (single school), and student roles. Features 20+20+60 scoring system, offline-first functionality with Firebase sync, and professional report card generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**August 14, 2025**
- ✅ **CLASS NAMING AND ORDERING SYSTEM FIXED** - All class names standardized to proper format (J.S.S 1, J.S.S 2, J.S.S 3, S.S.S 1, S.S.S 2, S.S.S 3)
- ✅ **CLASS DISPLAY ORDER CORRECTED** - Classes now appear in proper academic progression order in all dropdowns and overviews
- ✅ **SUBJECT ASSIGNMENT SYSTEM COMPLETED** - Fixed missing API endpoint and added Create New Subject button to overview
- ✅ **OVERVIEW STREAMLINED** - Removed redundant Subject Assignment section from overview tab (available in class details)
- ✅ **DEBUG CODE CLEANED** - Removed temporary debug logging from class sorting function
- ✅ **RECORD SCORES BUTTON ADDED** - Added Record Scores button in class details that navigates to Scores tab with class, term, and session pre-selected
- ✅ **APP STABILITY RESTORED** - Fixed infinite redirect loops causing app glitching by removing aggressive security code
- ✅ **FORM RESET FUNCTIONALITY** - Student creation form now properly resets when dialog is closed
- ✅ **COMPREHENSIVE ATTENDANCE TRACKING SYSTEM COMPLETED** - Full attendance management with total score input per student
- ✅ **ATTENDANCE DATABASE SCHEMA** - Added attendance table with studentId, classId, term, session, totalDays, presentDays, absentDays
- ✅ **ATTENDANCE API ENDPOINTS** - Complete CRUD operations for attendance tracking with authentication
- ✅ **ATTENDANCE MANAGEMENT UI** - Professional interface for inputting attendance scores by class, term, and session
- ✅ **ATTENDANCE PERCENTAGE CALCULATION** - Auto-calculated attendance percentages with color-coded badges
- ✅ **ATTENDANCE TAB IN ADMIN DASHBOARD** - New dedicated tab for attendance management with full functionality
- ✅ **REAL ATTENDANCE DATA INTEGRATION** - Replaced fake attendance data with real database-driven attendance tracking
- ✅ **ATTENDANCE STORAGE METHODS** - Enhanced storage interface with attendance operations (upsert, get by student/class)

**August 12, 2025**
- ✅ **COMPREHENSIVE STUDENT CREATION SYSTEM COMPLETED** - Full form with single-word validation for names
- ✅ **WHATSAPP PARENT CONTACT FIELD IMPLEMENTED** - Required field for parent WhatsApp communication
- ✅ **AUTO-GENERATED STUDENT IDs** - SOWA/x000 format automatically assigned based on school
- ✅ **ENHANCED BACKEND API** - Comprehensive student creation with all demographic fields
- ✅ **SINGLE-WORD NAME VALIDATION** - Real-time validation prevents spaces in names
- ✅ **COMPLETE STORAGE LAYER** - Enhanced methods for school numbering and student counting
- ✅ **CLASS-BASED STUDENT VIEWING** - Students displayed by class, not all at once
- ✅ **SUBJECT ASSIGNMENT TO CLASSES** - Main admin can assign subjects to specific classes

**August 7, 2025**
- ✅ **STUDENT ID FORMAT STANDARDIZED** - Updated to SOWA/x000 format where x is school number (1,2,3,4)
- ✅ **STUDENT FINANCIAL PORTAL COMPLETED** - Real financial data now displays instead of ₦0.00 placeholders
- ✅ **TERM/SESSION SELECTION FOR REPORT CARDS** - Students can select academic term and session to view specific reports
- ✅ **ENHANCED STUDENT DASHBOARD** - Financial tab shows real fee assignments and payment history
- ✅ **DATABASE FIX** - Fixed array query errors that prevented fee assignment functionality

**August 3, 2025**
- ✅ **STUDENT PASSWORD CHANGE FEATURE COMPLETED** - Students can now change their passwords securely
- ✅ **SECURITY TAB ADDED TO STUDENT DASHBOARD** - New dedicated security section with password change form
- ✅ **PASSWORD VALIDATION** - Full form validation with current password verification and confirmation matching
- ✅ **PASSWORD VISIBILITY TOGGLES** - Eye/EyeOff icons for showing/hiding password fields
- ✅ **SECURE BACKEND ENDPOINT** - `/api/auth/change-password` with proper authentication and validation
- ✅ **PASSWORD SECURITY TIPS** - User-friendly security guidelines displayed in the interface
- ✅ **REPORT CARD SINGLE-PAGE OPTIMIZATION** - All report card content fits on one page with full subject names
- ✅ **SCHOOL EDITING SYSTEM COMPLETED** - Schools can now be edited with proper database persistence
- ✅ **SCHOOL ORDER CONSISTENCY FIXED** - Schools maintain 1,2,3,4 order after editing (ordered by name)
- ✅ **INDIVIDUAL SCHOOL LOGOS REMOVED** - Single global academy logo system only
- ✅ **CONTROLLED FORM INPUTS** - School editing uses proper state management with controlled components
- ✅ **SERVER API ENDPOINTS** - Added updateSchool endpoint with proper validation
- ✅ **GLOBAL LOGO MANAGEMENT SYSTEM COMPLETED** - All schools now share one academy logo
- ✅ **LOGO UPLOAD FEATURE FULLY ACTIVE** - Upload functionality working with server endpoints
- ✅ **REMOVED ALL "COMING SOON" MESSAGES** - All features now have proper functionality
- ✅ **MOBILE RESPONSIVE HEADER COMPLETED** - Full mobile-first responsive design
- ✅ **ALL BUTTON FEATURES IMPLEMENTED** - Every button now shows its functionality when clicked
- ✅ **HOVER TOOLTIPS COMPLETED** - All buttons now show descriptive tooltips explaining their features
- ✅ Logo size adapts (8x8 mobile, 10x10 desktop) with proper text scaling
- ✅ Mobile navigation with icon-only buttons and responsive tab layout
- ✅ School selector moves below header on mobile for space optimization
- ✅ Complete report card generation system with professional PDF printing
- ✅ Full score entry system with 20+20+60 marking scheme working
- ✅ Class details modal shows student lists with "Add Student" flow
- ✅ Student creation with auto-generated SOWA/#### IDs working
- ✅ Password visibility toggle on all password fields
- ✅ Comprehensive button functionality across all dashboard tabs

**August 2, 2025**
- ✅ Removed all placeholder data from database (students, classes, users, assessments)
- ✅ Fixed main admin authentication (adahrukki@gmail.com / password123)
- ✅ Updated dashboard logo to use custom logo image (4oWHptM_1754171230437.gif)
- ✅ Firebase sync working as backup system with PostgreSQL as primary database
- ✅ Database properly structured with schools → classes hierarchy
- ✅ Cleaned database of all placeholder data - only admin user and schools remain

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite for fast development and optimized builds
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Data Validation**: Zod schemas for type-safe validation
- **Storage Interface**: Abstracted storage layer with in-memory implementation for development
- **Session Management**: Express sessions with PostgreSQL store capability
- **Development**: Hot reloading with tsx and Vite middleware integration

### Authentication & Authorization
- **Authentication**: Firebase Authentication with JWT tokens and local fallback
- **Main Admin**: adahrukki@gmail.com (Firebase authenticated)
- **Session Handling**: Express sessions with PostgreSQL store
- **Role-based Access**: Admin (all schools), sub-admin (single school), student roles with protected routes
- **Security**: Firebase Auth integration, password hashing, token validation, and secure session management

### Data Schema
- **User Management**: Complete user system with roles (admin/sub-admin/student) and authentication
- **Multi-Branch Structure**: Schools, classes, subjects, and class-subject relationships with branch isolation
- **Student Records**: Student profiles linked to users, classes, and specific school branches with SOWA/0001 ID pattern
- **Assessment System**: 20+20+60 scoring system (1st CA, 2nd CA, Exam) with automatic total calculation and grading
- **Report Cards**: Printable report cards with comprehensive academic summaries for Seat of Wisdom Academy
- **Database Relations**: Properly normalized PostgreSQL schema with Firebase sync capabilities

### Development Environment
- **Monorepo Structure**: Shared schemas and types between client and server
- **TypeScript Configuration**: Unified tsconfig with path mapping for clean imports
- **Development Workflow**: Concurrent frontend/backend development with Vite proxy
- **Replit Integration**: Custom plugins for development environment optimization

## External Dependencies

### Core Dependencies
- **Firebase**: Authentication and Firestore database for production data storage
- **Neon Database**: Serverless PostgreSQL for production database hosting
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **TanStack Query**: Server state management and caching
- **shadcn/ui**: Pre-built accessible UI components

### UI & Styling
- **Radix UI**: Headless component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Type-safe CSS class variants

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across the application
- **ESBuild**: Fast JavaScript bundling for production
- **PostCSS**: CSS processing with Tailwind integration

### Validation & Forms
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Performance-focused form library
- **@hookform/resolvers**: Zod integration for form validation