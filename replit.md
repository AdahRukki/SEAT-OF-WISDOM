# Seat of Wisdom Academy

## Overview

A comprehensive multi-branch academy management system for **Seat of Wisdom Academy** built with React (frontend) and Express (backend) featuring complete student score tracking, administrative controls, and Firebase database integration. The application supports 4 school branches (School 1, School 2, School 3, School 4) with role-based access for admin (all schools), sub-admin (single school), and student roles. Features 20+20+60 scoring system, offline-first functionality with Firebase sync, and professional report card generation.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Session Handling**: Express sessions with PostgreSQL store
- **Role-based Access**: Admin and student roles with protected routes
- **Security**: Password hashing, token validation, and secure session management

### Data Schema
- **User Management**: Complete user system with roles (admin/sub-admin/student) and authentication
- **Multi-Branch Structure**: Schools, classes, subjects, and class-subject relationships with branch isolation
- **Student Records**: Student profiles linked to users, classes, and specific school branches
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