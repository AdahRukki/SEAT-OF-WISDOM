# Seat of Wisdom Academy

## Overview
Seat of Wisdom Academy is a multi-branch academy management system for efficient administration and student performance tracking. Built with a React frontend and Express backend, it integrates Firebase for offline-first capabilities and real-time data synchronization. The system supports four school branches and features role-based access for administrators, sub-administrators, and students. Key capabilities include a 20+20+60 scoring system, professional report card generation, robust student financial tracking, complete teacher grading interface, and a news management system. The project provides a streamlined, scalable solution for academy management with full CRUD operations for students, class-based grading, and comprehensive educational oversight tools. It aims to offer a complete, modern solution for academy management with a focus on user experience and data integrity, including PWA installation for offline access and SEO optimization for discoverability.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
-   **Framework**: React 18 with TypeScript
-   **Routing**: Wouter for client-side routing
-   **UI Components**: shadcn/ui built on Radix UI
-   **Styling**: Tailwind CSS with CSS variables
-   **State Management**: TanStack Query for server state
-   **Form Handling**: React Hook Form with Zod validation
-   **Build Tool**: Vite
-   **UI/UX Decisions**: Responsive design for all modules (dashboard, scores, report cards, news), professional report card template, mobile-friendly forms and buttons, PWA installation support.

### Backend Architecture
-   **Framework**: Express.js with TypeScript
-   **Database ORM**: Drizzle ORM for PostgreSQL
-   **Data Validation**: Zod schemas
-   **Storage Interface**: Abstracted storage layer
-   **Session Management**: Express sessions with PostgreSQL store
-   **Development**: Hot reloading with tsx and Vite middleware
-   **Technical Implementations**: Intelligent student ID reuse, score publication control, comprehensive security features including auto-logout and JWT invalidation, Excel-based bulk student and score uploads, system-wide inactive student filtering.

### Authentication & Authorization
-   **Authentication**: Firebase Authentication with JWT and local fallback.
-   **Firebase Configuration**: Production-ready async configuration loading, offline persistence, auto-detection of long-polling, comprehensive error handling.
-   **Session Handling**: Express sessions with PostgreSQL store.
-   **Role-based Access**: Admin (all schools), sub-admin (single school), student with granular control over features (e.g., user management restricted to main admin).
-   **Security**: Password hashing, token validation, secure session management, auto-logout on inactivity/offline, critical bug fixes for session invalidation.

### Data Schema
-   **User Management**: Roles for admin, sub-admin, and student with isActive flag for soft deletion.
-   **Multi-Branch Structure**: Schools, classes, subjects, with branch isolation (e.g., School 1 Ikpoto, School 2 Bonsaac).
-   **Student Records**: Profiles linked to users, classes, and school branches (SOWA/#### ID), including parent WhatsApp as primary contact. Inactive students (isActive = false) are automatically filtered from all system queries while preserving historical data.
-   **Assessment System**: 20+20+60 scoring with automatic grading and subject filtering.
-   **Report Cards**: Professional, printable academic summaries with school header, statistics, and behavioral assessment.
-   **News System**: Public news articles with title, content, images, tags, and publication dates, transformed into a blog format with individual article pages.
-   **Notifications**: In-app student notifications with real-time inbox, unread counts, and broadcast messaging.
-   **Database Relations**: Normalized PostgreSQL schema with Firebase sync, including database-level validation for duplicate subjects.

### Development Environment
-   **Monorepo Structure**: Shared schemas and types.
-   **TypeScript Configuration**: Unified tsconfig.
-   **Development Workflow**: Concurrent frontend/backend development with Vite proxy.

## External Dependencies

### Core Dependencies
-   **Firebase**: Authentication and Firestore database for real-time sync and offline capabilities.
-   **Neon Database**: Serverless PostgreSQL hosting for production and development.
-   **Drizzle ORM**: Type-safe PostgreSQL operations.
-   **TanStack Query**: Server state management and caching.
-   **shadcn/ui**: Pre-built UI components.

### UI & Styling
-   **Radix UI**: Headless component primitives.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Lucide React**: Icon library.
-   **class-variance-authority**: Type-safe CSS class variants.

### Development Tools
-   **Vite**: Build tool and development server.
-   **TypeScript**: Type safety.
-   **ESBuild**: Fast JavaScript bundling.
-   **PostCSS**: CSS processing.
-   **PM2**: Process management for Node.js applications in production.

### Validation & Forms
-   **Zod**: Runtime type validation.
-   **React Hook Form**: Performance-focused form library.
-   **@hookform/resolvers**: Zod integration for form validation.

### Other Integrations
-   **Google Search Console**: Robots.txt, dynamic sitemap.xml, image sitemap for SEO.
-   **Google Analytics**: G-2TBCEHSG1L tracking for site traffic and analytics.
-   **Resend**: Email integration for sending contact form notifications to admin emails (adahrukki@gmail.com, admin@seatofwisdomacademy.com).
-   **ObjectUploader**: For image uploads in news management.
-   **Contact Form**: Public contact form on /contact page saves submissions to database and sends email notifications.