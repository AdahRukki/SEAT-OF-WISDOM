# Seat of Wisdom Academy - System Architecture

## Current Architecture (Working System)

### Primary Database: PostgreSQL
- **Purpose**: Main data storage for all academy operations
- **Location**: Hosted on Neon (serverless PostgreSQL)
- **Status**: ✅ Working perfectly
- **Contains**: Schools, Students, Classes, Subjects, Assessments

### API Layer: Express.js
- **Purpose**: Backend API for frontend communication  
- **Endpoints**: `/api/admin/*`, `/api/student/*`, `/api/auth/*`
- **Status**: ✅ Fully functional
- **Security**: JWT authentication, role-based access

### Frontend: React + TypeScript
- **Purpose**: User interface for admin and student dashboards
- **Status**: ✅ Working with some TypeScript errors to fix
- **Features**: Student management, score entry, role-based dashboards

## Firebase Integration (Enhancement Layer)

### What Firebase Does:
- **Backup Storage**: Copies data to cloud for redundancy
- **Offline Sync**: Allows offline operation with sync when online
- **Real-time Updates**: Multi-user collaboration features

### What Firebase Does NOT Do:
- Replace PostgreSQL (PostgreSQL remains primary)
- Handle authentication (still uses Express JWT)
- Break existing functionality

## Data Flow:

```
Frontend → API (Express) → PostgreSQL (Primary)
    ↓
Firebase (Backup/Sync)
```

## Why This Approach:

1. **PostgreSQL**: Fast, reliable, already working
2. **API**: Clean separation, security, role management  
3. **Firebase**: Modern sync features without breaking existing system

## User Actions:

1. **Create Student**: Saved to PostgreSQL → Synced to Firebase
2. **Enter Scores**: Saved to PostgreSQL → Synced to Firebase  
3. **Offline Mode**: Saved locally → Synced when online

## No Manual Database Creation Needed:
- PostgreSQL: Already provisioned and seeded
- Firebase: Auto-creates collections when first data is written

## Current Status:
- ✅ PostgreSQL + API: Fully working
- 🔄 Firebase Sync: Being fixed (connection issue resolved)
- 🔧 TypeScript Errors: Need cleanup for better development experience