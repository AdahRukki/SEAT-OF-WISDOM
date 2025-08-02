import { db } from "./db";
import {
  schools,
  users,
  students,
  classes,
  subjects,
  classSubjects,
  assessments,
  reportCardTemplates,
  type InsertSchool,
  type InsertUser,
  type InsertStudent,
  type InsertClass,
  type InsertSubject,
  type InsertAssessment,
  type InsertReportCardTemplate,
} from "@shared/schema";
import bcrypt from "bcrypt";

async function seedDatabase() {
  console.log("Starting comprehensive database seeding for Seat of Wisdom Academy...");

  try {
    // Clear existing data first
    await db.delete(assessments);
    await db.delete(classSubjects);
    await db.delete(students);
    await db.delete(classes);
    await db.delete(subjects);
    await db.delete(users);
    await db.delete(schools);
    await db.delete(reportCardTemplates);
    console.log("✓ Cleared existing data");

    // Create 4 school branches for Seat of Wisdom Academy
    const [school1, school2, school3, school4] = await db.insert(schools).values([
      {
        name: "School 1",
        address: "123 Education Street, Branch 1 District",
        phone: "+234-801-234-5678",
        email: "school1@seatofwisdom.edu"
      },
      {
        name: "School 2",
        address: "456 Learning Avenue, Branch 2 District",
        phone: "+234-802-345-6789",
        email: "school2@seatofwisdom.edu"
      },
      {
        name: "School 3", 
        address: "789 Knowledge Road, Branch 3 District",
        phone: "+234-803-456-7890",
        email: "school3@seatofwisdom.edu"
      },
      {
        name: "School 4",
        address: "321 Wisdom Lane, Branch 4 District", 
        phone: "+234-804-567-8901",
        email: "school4@seatofwisdom.edu"
      }
    ]).returning();
    console.log("✓ Created 4 school branches for Seat of Wisdom Academy");

    // Create users with proper hashed passwords
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create 1 main admin (access to all schools)
    const [mainAdmin] = await db.insert(users).values([
      {
        email: "admin@seatofwisdom.edu",
        password: hashedPassword,
        firstName: "Super",
        lastName: "Administrator",
        role: "admin",
        schoolId: null // Main admin has access to all schools
      }
    ]).returning();

    // Create 4 sub-admins (one for each branch)
    const [admin1, admin2, admin3, admin4] = await db.insert(users).values([
      {
        email: "admin1@seatofwisdom.edu",
        password: hashedPassword,
        firstName: "School 1",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: school1.id
      },
      {
        email: "admin2@seatofwisdom.edu",
        password: hashedPassword,
        firstName: "School 2",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: school2.id
      },
      {
        email: "admin3@seatofwisdom.edu",
        password: hashedPassword,
        firstName: "School 3",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: school3.id
      },
      {
        email: "admin4@seatofwisdom.edu",
        password: hashedPassword,
        firstName: "School 4",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: school4.id
      }
    ]).returning();
    console.log("✓ Created admin accounts");

    // Create subjects (global across all schools)
    const [mathematics, english, science, socialStudies, arts, french] = await db.insert(subjects).values([
      {
        name: "Mathematics",
        code: "MATH",
        description: "Basic mathematics and arithmetic"
      },
      {
        name: "English Language",
        code: "ENG",
        description: "English language and literature"
      },
      {
        name: "Basic Science",
        code: "SCI",
        description: "Introduction to science concepts"
      },
      {
        name: "Social Studies",
        code: "SOC",
        description: "History, geography and civic education"
      },
      {
        name: "Creative Arts",
        code: "ART",
        description: "Drawing, painting and creative expression"
      },
      {
        name: "French Language",
        code: "FRE",
        description: "Basic French language skills"
      }
    ]).returning();
    console.log("✓ Created subjects");

    // Create classes for each school branch
    const allClasses = [];
    
    // School 1 classes
    const school1Classes = await db.insert(classes).values([
      { name: "Grade 5A", description: "Primary 5 class A", schoolId: school1.id },
      { name: "Grade 5B", description: "Primary 5 class B", schoolId: school1.id },
      { name: "Grade 6A", description: "Primary 6 class A", schoolId: school1.id },
      { name: "Grade 6B", description: "Primary 6 class B", schoolId: school1.id }
    ]).returning();
    allClasses.push(...school1Classes);

    // School 2 classes  
    const school2Classes = await db.insert(classes).values([
      { name: "Grade 4A", description: "Primary 4 class A", schoolId: school2.id },
      { name: "Grade 4B", description: "Primary 4 class B", schoolId: school2.id },
      { name: "Grade 5A", description: "Primary 5 class A", schoolId: school2.id }
    ]).returning();
    allClasses.push(...school2Classes);

    // School 3 classes
    const school3Classes = await db.insert(classes).values([
      { name: "Grade 3A", description: "Primary 3 class A", schoolId: school3.id },
      { name: "Grade 3B", description: "Primary 3 class B", schoolId: school3.id },
      { name: "Grade 4A", description: "Primary 4 class A", schoolId: school3.id }
    ]).returning();
    allClasses.push(...school3Classes);

    // School 4 classes
    const school4Classes = await db.insert(classes).values([
      { name: "Grade 2A", description: "Primary 2 class A", schoolId: school4.id },
      { name: "Grade 2B", description: "Primary 2 class B", schoolId: school4.id },
      { name: "Grade 3A", description: "Primary 3 class A", schoolId: school4.id }
    ]).returning();
    allClasses.push(...school4Classes);
    console.log("✓ Created classes for all branches");

    // Assign subjects to all classes
    const classSubjectMappings = [];
    const allSubjects = [mathematics, english, science, socialStudies, arts, french];
    
    for (const classItem of allClasses) {
      for (const subject of allSubjects) {
        classSubjectMappings.push({
          classId: classItem.id,
          subjectId: subject.id
        });
      }
    }
    
    await db.insert(classSubjects).values(classSubjectMappings);
    console.log("✓ Assigned subjects to classes");

    // Create sample students for each school
    // School 1 students
    const school1StudentUsers = await db.insert(users).values([
      {
        email: "john.doe@student.com",
        password: hashedPassword,
        firstName: "John",
        lastName: "Doe",
        role: "student",
        schoolId: school1.id
      },
      {
        email: "jane.smith@student.com",
        password: hashedPassword,
        firstName: "Jane",
        lastName: "Smith",
        role: "student",
        schoolId: school1.id
      },
      {
        email: "mike.johnson@student.com",
        password: hashedPassword,
        firstName: "Mike",
        lastName: "Johnson",
        role: "student",
        schoolId: school1.id
      }
    ]).returning();

    const school1Students = await db.insert(students).values([
      {
        userId: school1StudentUsers[0].id,
        classId: school1Classes[0].id, // Grade 5A
        studentId: "SOWA/0001",
        parentContact: "+234-701-111-1111"
      },
      {
        userId: school1StudentUsers[1].id,
        classId: school1Classes[0].id, // Grade 5A
        studentId: "SOWA/0002", 
        parentContact: "+234-701-111-2222"
      },
      {
        userId: school1StudentUsers[2].id,
        classId: school1Classes[1].id, // Grade 5B
        studentId: "SOWA/0003",
        parentContact: "+234-701-111-3333"
      }
    ]).returning();

    // School 2 students
    const school2StudentUsers = await db.insert(users).values([
      {
        email: "alice.wilson@student.com",
        password: hashedPassword,
        firstName: "Alice",
        lastName: "Wilson",
        role: "student",
        schoolId: school2.id
      },
      {
        email: "bob.brown@student.com",
        password: hashedPassword,
        firstName: "Bob",
        lastName: "Brown",
        role: "student",
        schoolId: school2.id
      }
    ]).returning();

    const school2Students = await db.insert(students).values([
      {
        userId: school2StudentUsers[0].id,
        classId: school2Classes[0].id, // Grade 4A
        studentId: "SOWA/0004",
        parentContact: "+234-702-222-1111"
      },
      {
        userId: school2StudentUsers[1].id,
        classId: school2Classes[1].id, // Grade 4B
        studentId: "SOWA/0005",
        parentContact: "+234-702-222-2222"
      }
    ]).returning();

    console.log("✓ Created sample students");

    // Create sample assessments for first term (20+20+60 system)
    const sampleAssessments = [];
    const allStudents = [...school1Students, ...school2Students];

    for (const student of allStudents) {
      for (const subject of allSubjects.slice(0, 3)) { // Math, English, Science only
        const firstCA = Math.floor(Math.random() * 15) + 5; // 5-20
        const secondCA = Math.floor(Math.random() * 15) + 5; // 5-20
        const exam = Math.floor(Math.random() * 40) + 20; // 20-60
        const total = firstCA + secondCA + exam;
        const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';

        sampleAssessments.push({
          studentId: student.id,
          subjectId: subject.id,
          classId: student.classId,
          term: "First Term",
          session: "2024/2025",
          firstCA,
          secondCA,
          exam,
          total,
          grade
        });
      }
    }

    await db.insert(assessments).values(sampleAssessments);
    console.log("✓ Created sample assessments with 20+20+60 scoring system");

    // Create default report card template
    await db.insert(reportCardTemplates).values([
      {
        name: "Seat of Wisdom Academy Standard Report Card",
        description: "Standard report card template for all branches",
        isDefault: true,
        template: JSON.stringify({
          header: {
            schoolName: "Seat of Wisdom Academy",
            logoUrl: "/assets/school-logo.png",
            address: "Nigeria",
            phone: "+234-800-WISDOM",
            email: "info@seatofwisdom.edu"
          },
          gradeScale: {
            A: "80-100 (Excellent)",
            B: "70-79 (Very Good)", 
            C: "60-69 (Good)",
            D: "50-59 (Satisfactory)",
            F: "0-49 (Needs Improvement)"
          },
          assessmentStructure: {
            firstCA: { name: "1st CA", maxMarks: 20 },
            secondCA: { name: "2nd CA", maxMarks: 20 },
            exam: { name: "Exam", maxMarks: 60 },
            total: { name: "Total", maxMarks: 100 }
          }
        })
      }
    ]);
    console.log("✓ Created default report card template");

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📋 Demo Accounts Created:");
    console.log("Main Admin: admin@seatofwisdom.edu / password123");
    console.log("School 1 Admin: admin1@seatofwisdom.edu / password123");
    console.log("School 2 Admin: admin2@seatofwisdom.edu / password123");
    console.log("School 3 Admin: admin3@seatofwisdom.edu / password123");
    console.log("School 4 Admin: admin4@seatofwisdom.edu / password123");
    console.log("Student: john.doe@student.com / password123");
    console.log("Student: alice.wilson@student.com / password123");
    console.log("\n🏫 Schools: School 1, School 2, School 3, School 4");
    console.log("📚 Subjects: Mathematics, English, Science, Social Studies, Arts, French");
    console.log("🎯 Scoring System: 1st CA (20) + 2nd CA (20) + Exam (60) = Total (100)");
    console.log("📋 Student ID Pattern: SOWA/0001, SOWA/0002, etc.");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  seedDatabase()
    .then(() => {
      console.log("Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedDatabase };