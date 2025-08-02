# Student Score Tracker

## Overview

A full-stack student management application built with React (frontend) and Express (backend) for tracking student information and scores. The application allows educators to manage student records, add scores, and view performance analytics with a clean, modern interface using shadcn/ui components and Firebase for authentication and data storage.

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
- **Provider**: Firebase Authentication
- **Session Handling**: Firebase Auth state management with React context
- **Protected Routes**: Authentication-based route protection using custom auth hooks

### Data Schema
- **Student Entity**: Core entity with fields for name, email, class, scores array, and timestamps
- **Score Tracking**: Array-based score storage with validation (0-100 range)
- **Validation**: Shared Zod schemas between frontend and backend for consistency

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