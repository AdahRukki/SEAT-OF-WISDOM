# Seat of Wisdom Academy

## Overview
Seat of Wisdom Academy is a comprehensive multi-branch academy management system designed for efficient administration and student performance tracking. Built with a React frontend and Express backend, it integrates Firebase for offline-first capabilities and real-time data synchronization. The system supports four school branches and features role-based access for administrators, sub-administrators, and students. Key capabilities include a 20+20+60 scoring system, professional report card generation, robust student financial tracking, and complete teacher grading interface. The project provides a streamlined, scalable solution for academy management with full CRUD operations for students, functional class-based grading, and comprehensive educational oversight tools.

## Recent Updates (October 2025)
- ✅ **Production Deployment Fix**: Fixed critical login issue by updating database driver to auto-detect environment (Neon for development, standard PostgreSQL for production), created ecosystem.config.cjs for PM2 process management
- ✅ **Admin User Creation**: Created production admin creation script (server/create-admin.ts) with proper password hashing and school assignment
- ✅ **User Management Security**: Restricted all user management routes to main admins only - sub-admins can no longer access user creation, editing, or deletion endpoints
- ✅ **Sub-Admin Access Control**: Added frontend access control to prevent sub-admins from viewing user management page and Settings tab, displays clear "Access Denied" message, Settings tab only visible to main admins
- ✅ **Profile Navigation**: User avatar/name in header is clickable and navigates to dedicated profile page (/portal/profile) where admins can view and edit their profile information
- ✅ **Mobile Responsive Dashboard**: Dashboard already includes comprehensive mobile responsiveness with adaptive grid layouts (2-column mobile to 10-column desktop) and proper breakpoints for all screen sizes
- ✅ **Firebase Initialization Fix**: Fixed critical admin dashboard crash by adding null checks for Firebase `db` instance throughout offline-firebase-sync.ts - prevents collection() errors when Firebase hasn't initialized yet, ensuring dashboard loads properly on cold starts
- ✅ **Sub-Admin Reports Access**: Fixed 403 error preventing sub-admins from accessing academic terms endpoint - sub-admins can now generate report cards for their assigned school while term creation/modification remains restricted to main admins
- ✅ **School Branch Renaming**: Updated all school branches from generic names to proper locations - School 1 Ikpoto, School 2 Bonsaac, School 3 Akwuofor, School 4 Akwuose
- ✅ **Production Firebase Configuration**: Enhanced Firebase initialization with production-ready features - async configuration loading with fallback to server endpoint, offline persistence for unreliable connections, auto-detection of long-polling for restrictive networks, comprehensive error handling and diagnostics, ensures Firebase works on custom domain (seatofwisdomacademy.com)
- ✅ **SEO Implementation**: Complete SEO system with dynamic meta tags, Open Graph tags for social sharing, Twitter Cards, and structured data (JSON-LD) for better search engine indexing - applied to homepage, news listing, individual blog posts, and login page with proper cleanup on navigation
- ✅ **Blog-Style News System**: Transformed news into blog format with individual article pages, "Read More" buttons, and proper navigation headers on all news pages
- ✅ **News Image Visibility Fix**: Implemented public ACL policies and signed URL generation for news images, ensuring images display correctly across all pages (homepage, news listing, article detail)
- ✅ **Academic Session Update**: Changed current session to 2024/2025
- ✅ **Score Publication Control System**: Complete implementation with admin publish/unpublish functionality, backend security enforcement, and student access control - students cannot view scores/reports until admin explicitly publishes them for each term/session/class combination
- ✅ **News Management System**: Complete implementation with admin CRUD operations, image uploads via ObjectUploader, and public news page
- ✅ **In-App Notifications**: Student notification system with real-time inbox, unread count badges, and broadcast messaging from admin
- ✅ **Enhanced Admin Dashboard**: Added News and Notifications tabs with modular component architecture

## Previous Updates (September 2025)
- ✅ **Password Management System**: Complete implementation with admin password changes and email-based user resets
- ✅ **Security Enhancement**: Fixed critical JWT session invalidation vulnerability after password changes
- ✅ **Teacher Grading Interface**: Fully functional with class selection and student loading
- ✅ **Student Management**: Complete CRUD operations with secure deletion functionality
- ✅ **Authentication System**: Enhanced with proper schoolId support and password security
- ✅ **Multi-School Support**: Proper admin/sub-admin role-based school access
- ✅ **Test Data**: Created sample students across multiple classes for testing grading workflows

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for PostgreSQL
- **Data Validation**: Zod schemas
- **Storage Interface**: Abstracted storage layer
- **Session Management**: Express sessions with PostgreSQL store
- **Development**: Hot reloading with tsx and Vite middleware

### Authentication & Authorization
- **Authentication**: Firebase Authentication with JWT and local fallback.
- **Firebase Configuration**: Production-ready async configuration loading with server-side fallback endpoint, environment variable support, offline persistence, auto-detection of long-polling for restrictive networks.
- **Session Handling**: Express sessions with PostgreSQL store.
- **Role-based Access**: Admin (all schools), sub-admin (single school), student.
- **Security**: Password hashing, token validation, secure session management.

### Data Schema
- **User Management**: Roles for admin, sub-admin, and student.
- **Multi-Branch Structure**: Schools, classes, subjects, with branch isolation.
- **Student Records**: Profiles linked to users, classes, and school branches (SOWA/#### ID).
- **Assessment System**: 20+20+60 scoring with automatic grading.
- **Report Cards**: Printable academic summaries.
- **News System**: Public news articles with title, content, images, tags, and publication dates.
- **Notifications**: In-app student notifications with read/unread status and fan-out broadcasting.
- **Database Relations**: Normalized PostgreSQL schema with Firebase sync.

### Development Environment
- **Monorepo Structure**: Shared schemas and types.
- **TypeScript Configuration**: Unified tsconfig.
- **Development Workflow**: Concurrent frontend/backend development with Vite proxy.

## External Dependencies

### Core Dependencies
- **Firebase**: Authentication and Firestore database.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle ORM**: Type-safe PostgreSQL operations.
- **TanStack Query**: Server state management and caching.
- **shadcn/ui**: Pre-built UI components.

### UI & Styling
- **Radix UI**: Headless component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **class-variance-authority**: Type-safe CSS class variants.

### Development Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Type safety.
- **ESBuild**: Fast JavaScript bundling.
- **PostCSS**: CSS processing.

### Validation & Forms
- **Zod**: Runtime type validation.
- **React Hook Form**: Performance-focused form library.
- **@hookform/resolvers**: Zod integration for form validation.