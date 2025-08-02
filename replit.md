# Student Score Tracker

## Overview

A comprehensive school management system built with React (frontend) and Express (backend) featuring complete student score tracking, administrative controls, and report card generation. The application provides both admin and student dashboards with JWT authentication, PostgreSQL database storage, and professional report card printing capabilities.

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
- **User Management**: Complete user system with roles (admin/student) and authentication
- **Academic Structure**: Classes, subjects, and class-subject relationships
- **Student Records**: Student profiles linked to users and classes
- **Assessment System**: First CA, Second CA, and Exam scores with automatic total calculation
- **Report Cards**: Printable report cards with comprehensive academic summaries
- **Database Relations**: Properly normalized PostgreSQL schema with foreign key constraints

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