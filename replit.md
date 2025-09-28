# Seat of Wisdom Academy

## Overview
Seat of Wisdom Academy is a comprehensive multi-branch academy management system designed for efficient administration and student performance tracking. Built with a React frontend and Express backend, it integrates Firebase for offline-first capabilities and real-time data synchronization. The system supports four school branches and features role-based access for administrators, sub-administrators, and students. Key capabilities include a 20+20+60 scoring system, professional report card generation, robust student financial tracking, and complete teacher grading interface. The project provides a streamlined, scalable solution for academy management with full CRUD operations for students, functional class-based grading, and comprehensive educational oversight tools.

## Recent Updates (September 2025)
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
- **Session Handling**: Express sessions with PostgreSQL store.
- **Role-based Access**: Admin (all schools), sub-admin (single school), student.
- **Security**: Password hashing, token validation, secure session management.

### Data Schema
- **User Management**: Roles for admin, sub-admin, and student.
- **Multi-Branch Structure**: Schools, classes, subjects, with branch isolation.
- **Student Records**: Profiles linked to users, classes, and school branches (SOWA/#### ID).
- **Assessment System**: 20+20+60 scoring with automatic grading.
- **Report Cards**: Printable academic summaries.
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