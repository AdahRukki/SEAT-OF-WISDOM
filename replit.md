# Seat of Wisdom Academy

## Overview

A comprehensive multi-branch academy management system for **Seat of Wisdom Academy** built with React (frontend) and Express (backend) featuring complete student score tracking, administrative controls, and Firebase database integration. The application supports 4 school branches (School 1, School 2, School 3, School 4) with role-based access for admin (all schools), sub-admin (single school), and student roles. Features 20+20+60 scoring system, offline-first functionality with Firebase sync, and professional report card generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**August 3, 2025**
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