# Firebase Setup Instructions for Seat of Wisdom Academy

## Overview
The system now uses **Firebase as the primary database** with offline-first functionality. Data is automatically saved to Firebase when online and stored locally when offline, then synced when connection is restored.

## 🔥 Firebase Configuration Required

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project named "Seat of Wisdom Academy"
3. Enable Firestore Database in production mode
4. Enable Authentication with Email/Password

### 2. Get Configuration Keys
Navigate to Project Settings and copy these values:
- `projectId` 
- `apiKey`
- `appId`

### 3. Add Secrets to Replit
Add these environment variables in Replit Secrets:
```
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=your-api-key  
VITE_FIREBASE_APP_ID=your-app-id
```

### 4. Firestore Database Structure
The system creates these collections automatically:
- `schools` - School branch data
- `classes` - Class information for each school
- `students` - Student profiles with SOWA/0001 IDs
- `assessments` - Score data (20+20+60 system)
- `subjects` - Academic subjects
- `users` - Authentication and user roles

## 📱 Offline-First Features

### ✅ What Works Offline:
- View existing student data
- Create new students and classes  
- Enter assessment scores
- Generate report cards
- All data queued for sync

### 🔄 Automatic Sync When Online:
- Uploads all offline changes to Firebase
- Downloads latest data from other users
- Real-time updates across devices
- Conflict resolution for simultaneous edits

### 🔍 Sync Status Indicator:
- **Green 🟢**: Online and synced with Firebase
- **Orange 🟠**: Offline mode, changes saved locally
- **Blue Number**: Shows pending sync operations
- **Refresh Button**: Manual sync trigger

## 🚀 Benefits

1. **No Data Loss**: Works completely offline
2. **Real-Time Sync**: Multiple admins can work simultaneously  
3. **Cloud Backup**: All data automatically backed up to Firebase
4. **Cross-Device**: Access from any device with same data
5. **Automatic Updates**: Changes appear instantly on other devices

## 🔧 Technical Details

- **Local Storage**: IndexedDB for offline data persistence
- **Sync Queue**: Operations queued and processed when online
- **Conflict Resolution**: Last-write-wins with timestamp comparison
- **Error Handling**: Automatic retry with exponential backoff
- **Performance**: Minimal impact, syncs in background

## 📋 Admin Features

The admin dashboard shows:
- Live sync status in header
- Number of pending sync operations
- Manual sync button for immediate upload
- Visual indicators for online/offline state

All data operations (students, classes, scores) automatically use Firebase with offline fallback.