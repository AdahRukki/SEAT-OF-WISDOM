# Student Score Tracker - Local Installation Guide

## Prerequisites
- Node.js (version 18 or higher)
- PostgreSQL database (or use SQLite for simpler setup)
- Git

## Installation Steps

### 1. Download the Project
```bash
# Clone or download the project files to your PC
git clone [your-repo-url]
cd student-score-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

#### Option A: PostgreSQL (Recommended)
1. Install PostgreSQL on your PC
2. Create a new database
3. Create a `.env` file with your database connection:
```
DATABASE_URL=postgresql://username:password@localhost:5432/school_db
SESSION_SECRET=your-secret-key-here
```

#### Option B: SQLite (Simpler)
1. Create a `.env` file:
```
DATABASE_URL=file:./school.db
SESSION_SECRET=your-secret-key-here
```

### 4. Initialize Database
```bash
# Push database schema
npm run db:push

# Seed with demo data
npx tsx server/seed.ts
```

### 5. Run the Application
```bash
npm run dev
```

### 6. Access the App
- Open your browser to `http://localhost:5000`
- Login with demo accounts:
  - Admin: admin@school.com / password123
  - Student: demo.student@school.com / password123

## Creating Desktop Shortcut
1. Create a batch file (Windows) or shell script (Mac/Linux)
2. Add the command to start your app
3. Create a desktop shortcut to this file

### Windows Example (start-school-app.bat):
```batch
@echo off
cd C:\path\to\your\school-app
npm run dev
start http://localhost:5000
```

### Mac/Linux Example (start-school-app.sh):
```bash
#!/bin/bash
cd /path/to/your/school-app
npm run dev
open http://localhost:5000
```

## Production Deployment
For a production setup on your PC:
1. Use PM2 or similar process manager
2. Set up nginx as reverse proxy
3. Configure SSL certificates
4. Set up automatic startup on boot

## Backup and Data
- Database files are stored locally
- Regular backups recommended
- Export student data as needed

## Troubleshooting
- Ensure Node.js and database are running
- Check firewall settings for port 5000
- Verify database connection in `.env` file