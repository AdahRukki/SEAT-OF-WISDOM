# Seat of Wisdom Academy - Database Information

## Database Type
**PostgreSQL** (Serverless via Neon) with Drizzle ORM

## Key Tables for Scores & Classes

### 1. **Schools Table**
- Stores 4 school branches (School 1, School 2, School 3, School 4)
- Each school has independent data isolation

### 2. **Classes Table** 
- Grade levels for each school (e.g., Grade 5A, Grade 5B)
- Linked to specific school branches
- Contains class descriptions and school associations

### 3. **Students Table**
- Student profiles with SOWA/0001 ID format
- Links students to their classes and school branches
- Stores parent contact information

### 4. **Subjects Table**
- Core subjects: Mathematics, English, Science, Social Studies, Arts, French
- Global subjects used across all school branches

### 5. **Assessments Table** 🎯
- **Score Storage**: 1st CA (20), 2nd CA (20), Exam (60) = Total (100)
- Student assessment data with automatic grade calculation
- Term and session tracking
- Subject-specific scoring

### 6. **Class-Subjects Table**
- Links subjects to specific classes
- Enables different curricula per school branch

### 7. **Users Table**
- Authentication for admin, sub-admin, and student roles
- Role-based access control

## Firebase Integration
- **Real-time sync** with Firestore for production data
- **Offline-first** functionality with sync queue
- Local PostgreSQL serves as primary development database

## Current Data
- 4 School branches populated
- Demo students with SOWA/0001+ IDs
- Sample assessments with 20+20+60 scoring
- Admin accounts for each school branch
- Complete class and subject structure

## Access Control
- **Main Admin**: Full access to all 4 schools
- **Sub-Admin**: Single school access only  
- **Students**: Personal academic records only