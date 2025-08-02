# STORAGE CLEANUP PLAN

## Problem Identified
Yesterday created 3 competing storage systems:
1. PostgreSQL (working via API) ✅
2. Local Storage (browser localStorage) ❌ Causing confusion
3. Firebase (cloud backup) ⚠️ Adding complexity

## Solution: Simplify to PostgreSQL + Clean Firebase Backup

### Step 1: Remove Local Storage System
- Remove `use-local-students.tsx` hook
- Remove `storage.ts` local storage functions  
- Keep only API-based data fetching

### Step 2: Fix API Queries  
- Fix TypeScript errors in admin dashboard
- Ensure proper API authentication
- Clean up query client configuration

### Step 3: Simplify Firebase to Backup Only
- Keep Firebase connection for future sync
- Remove complex offline-first logic
- Make Firebase a simple backup destination

### Result
Clean system: Frontend → API → PostgreSQL → Firebase backup