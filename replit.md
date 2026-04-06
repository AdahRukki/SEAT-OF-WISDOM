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
-   **Prefetch Strategy**: Phase 1 (global: academic info, sessions, terms, subjects, news) + Phase 2 (per-school: students, classes, fee types, payments, student fees, financial summary). Per-class data (subjects, assessments) loads lazily on demand when user selects a class. Finance/attendance term+session auto-sync from active academic info.
-   **Per-School Session Isolation**: Each school has its own `current_term` and `current_session` columns in the `schools` table. `/api/current-academic-info?schoolId=X` returns that school's active term/session. `/api/admin/advance-term` with `{ schoolId }` in body advances only that school's term, creating session/term records if needed. Falls back to global active flags if school-level values are missing.

### Authentication & Authorization
-   **Authentication**: Firebase Authentication with JWT and local fallback. Offline login supported via cached credentials (SHA-256 hashed passwords stored locally after first successful login).
-   **Firebase Configuration**: Production-ready async configuration loading, offline persistence, auto-detection of long-polling, comprehensive error handling.
-   **Session Handling**: Express sessions with PostgreSQL store. JWT tokens valid for 7 days.
-   **Role-based Access**: Admin (all schools), sub-admin (single school), student with granular control over features (e.g., user management restricted to main admin).
-   **Security**: Password hashing, token validation, secure session management, 4-hour inactivity timeout (skipped when offline), auto-reconnect to server when back online. Offline auth credentials preserved across logouts for seamless re-login.
-   **Offline Login Flow**: On login attempt: try server first → if network error, fall back to locally cached credentials → show offline mode indicator. When connectivity returns, silently re-authenticate with server. Cached credentials expire after 30 days. Logout preserves the service worker app-shell cache (only clears API response caches) so the PWA can load offline after logout.
-   **Offline Student Creation**: Students created offline are saved to `sowa_offline_students` in localStorage with a temporary `PENDING-{timestamp}` ID. They appear in the student list with a "Pending Sync" badge and "—" for SOWA ID. When connectivity returns, the offline queue syncs and offline student entries are cleaned up automatically. Offline students are excluded from scores/payments.
-   **Auto-Migration**: `server/index.ts` runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on startup for any schema columns that may be missing from the production database (e.g., `current_term`, `current_session` on the `schools` table).

### Data Schema
-   **User Management**: Roles for admin, sub-admin, and student with isActive flag for soft deletion.
-   **Multi-Branch Structure**: Schools, classes, subjects, with branch isolation (e.g., School 1 Ikpoto, School 2 Bonsaac).
-   **Student Records**: Profiles linked to users, classes, and school branches (SOWA/#### ID), including parent WhatsApp as primary contact. Inactive students (isActive = false) are automatically filtered from all system queries while preserving historical data.
-   **Assessment System**: 20+20+60 scoring with automatic grading and subject filtering.
-   **Report Cards**: Professional, printable academic summaries with school header, statistics, and behavioral assessment. Bulk validation endpoints (`validate-report-data-bulk` for single class, `validate-report-data-school` for entire school) replace sequential per-student API calls with 4 DB queries total regardless of student count. Auto-validates on class/term/session selection.
-   **News System**: Public news articles with title, content, images, tags, and publication dates, transformed into a blog format with individual article pages.
-   **Notifications**: In-app student notifications with real-time inbox, unread counts, and broadcast messaging.
-   **Payment Tracking & Reconciliation System**: Comprehensive fee payment management with:
    -   **Bank Statement Parsing**: Multi-bank PDF parser supporting Zenith, Access, and Fidelity formats. Fidelity uses dedicated parser for `D-Mon-YY` date format and "Pay In"/"Pay Out" column layout. Generic parser handles `DD/MM/YYYY`, `DD-MM-YYYY`, and `D-Mon-YY` date formats.
    -   **Statement Deletion**: Admin can delete a processed bank statement and all its associated transactions via trash icon in Upload History.
    -   **Fee Payment Records**: Student payments recorded by bursars/sub-admins with status tracking (recorded, confirmed, reversed).
    -   **Bank Statement Processing**: CSV/Excel upload with duplicate detection using SHA256 fingerprinting.
    -   **Bank Transactions**: Imported transactions with matching, confidence scoring, and status tracking.
    -   **Payment Allocations**: Many-to-many linking between payments and bank transactions for reconciliation.
    -   **Multi-Student Allocation**: Single bank transaction can be split across multiple students.
    -   **Audit Logs**: Full audit trail for all payment actions (recording, confirmation, reversal, allocation).
    -   **Role-based Access**: Bursars and sub-admins can record payments; only admins can upload statements, confirm, and reverse.
    -   **Offline-First Recording**: Bursars can record payments offline with automatic sync when online.
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