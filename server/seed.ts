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
  console.log("Starting comprehensive database seeding...");

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

    // Create 4 school branches
    const [mainCampus, eastBranch, westBranch, northBranch] = await db.insert(schools).values([
      {
        name: "Sunshine Academy - Main Campus",
        address: "123 Education Street, Central District",
        phone: "+234-801-234-5678",
        email: "main@sunshine-academy.edu"
      },
      {
        name: "Sunshine Academy - East Branch",
        address: "456 Learning Avenue, East District",
        phone: "+234-802-345-6789",
        email: "east@sunshine-academy.edu"
      },
      {
        name: "Sunshine Academy - West Branch", 
        address: "789 Knowledge Road, West District",
        phone: "+234-803-456-7890",
        email: "west@sunshine-academy.edu"
      },
      {
        name: "Sunshine Academy - North Branch",
        address: "321 Wisdom Lane, North District", 
        phone: "+234-804-567-8901",
        email: "north@sunshine-academy.edu"
      }
    ]).returning();
    console.log("✓ Created 4 school branches");

    // Create users with proper hashed passwords
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create 1 main admin (access to all schools)
    const [mainAdmin] = await db.insert(users).values([
      {
        email: "admin@sunshine-academy.edu",
        password: hashedPassword,
        firstName: "Super",
        lastName: "Administrator",
        role: "admin",
        schoolId: null // Main admin has access to all schools
      }
    ]).returning();

    // Create 4 sub-admins (one for each branch)
    const [eastAdmin, westAdmin, northAdmin, mainBranchAdmin] = await db.insert(users).values([
      {
        email: "east.admin@sunshine-academy.edu",
        password: hashedPassword,
        firstName: "East",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: eastBranch.id
      },
      {
        email: "west.admin@sunshine-academy.edu",
        password: hashedPassword,
        firstName: "West",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: westBranch.id
      },
      {
        email: "north.admin@sunshine-academy.edu",
        password: hashedPassword,
        firstName: "North",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: northBranch.id
      },
      {
        email: "main.admin@sunshine-academy.edu",
        password: hashedPassword,
        firstName: "Main",
        lastName: "Administrator",
        role: "sub-admin",
        schoolId: mainCampus.id
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
    
    // Main Campus classes
    const mainClasses = await db.insert(classes).values([
      { name: "Grade 5A", description: "Primary 5 class A", schoolId: mainCampus.id },
      { name: "Grade 5B", description: "Primary 5 class B", schoolId: mainCampus.id },
      { name: "Grade 6A", description: "Primary 6 class A", schoolId: mainCampus.id },
      { name: "Grade 6B", description: "Primary 6 class B", schoolId: mainCampus.id }
    ]).returning();
    allClasses.push(...mainClasses);

    // East Branch classes  
    const eastClasses = await db.insert(classes).values([
      { name: "Grade 4A", description: "Primary 4 class A", schoolId: eastBranch.id },
      { name: "Grade 4B", description: "Primary 4 class B", schoolId: eastBranch.id },
      { name: "Grade 5A", description: "Primary 5 class A", schoolId: eastBranch.id }
    ]).returning();
    allClasses.push(...eastClasses);

    // West Branch classes
    const westClasses = await db.insert(classes).values([
      { name: "Grade 3A", description: "Primary 3 class A", schoolId: westBranch.id },
      { name: "Grade 3B", description: "Primary 3 class B", schoolId: westBranch.id },
      { name: "Grade 4A", description: "Primary 4 class A", schoolId: westBranch.id }
    ]).returning();
    allClasses.push(...westClasses);

    // North Branch classes
    const northClasses = await db.insert(classes).values([
      { name: "Grade 2A", description: "Primary 2 class A", schoolId: northBranch.id },
      { name: "Grade 2B", description: "Primary 2 class B", schoolId: northBranch.id },
      { name: "Grade 3A", description: "Primary 3 class A", schoolId: northBranch.id }
    ]).returning();
    allClasses.push(...northClasses);
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
    const studentUsers = [];
    const studentRecords = [];

    // Main Campus students
    const mainStudentUsers = await db.insert(users).values([
      {
        email: "john.doe@student.com",
        password: hashedPassword,
        firstName: "John",
        lastName: "Doe",
        role: "student",
        schoolId: mainCampus.id
      },
      {
        email: "jane.smith@student.com",
        password: hashedPassword,
        firstName: "Jane",
        lastName: "Smith",
        role: "student",
        schoolId: mainCampus.id
      },
      {
        email: "mike.johnson@student.com",
        password: hashedPassword,
        firstName: "Mike",
        lastName: "Johnson",
        role: "student",
        schoolId: mainCampus.id
      }
    ]).returning();

    const mainStudents = await db.insert(students).values([
      {
        userId: mainStudentUsers[0].id,
        classId: mainClasses[0].id, // Grade 5A
        studentId: "MAIN001",
        parentContact: "+234-701-111-1111"
      },
      {
        userId: mainStudentUsers[1].id,
        classId: mainClasses[0].id, // Grade 5A
        studentId: "MAIN002", 
        parentContact: "+234-701-111-2222"
      },
      {
        userId: mainStudentUsers[2].id,
        classId: mainClasses[1].id, // Grade 5B
        studentId: "MAIN003",
        parentContact: "+234-701-111-3333"
      }
    ]).returning();

    // East Branch students
    const eastStudentUsers = await db.insert(users).values([
      {
        email: "alice.wilson@student.com",
        password: hashedPassword,
        firstName: "Alice",
        lastName: "Wilson",
        role: "student",
        schoolId: eastBranch.id
      },
      {
        email: "bob.brown@student.com",
        password: hashedPassword,
        firstName: "Bob",
        lastName: "Brown",
        role: "student",
        schoolId: eastBranch.id
      }
    ]).returning();

    const eastStudents = await db.insert(students).values([
      {
        userId: eastStudentUsers[0].id,
        classId: eastClasses[0].id, // Grade 4A
        studentId: "EAST001",
        parentContact: "+234-702-222-1111"
      },
      {
        userId: eastStudentUsers[1].id,
        classId: eastClasses[1].id, // Grade 4B
        studentId: "EAST002",
        parentContact: "+234-702-222-2222"
      }
    ]).returning();

    console.log("✓ Created sample students");

    // Create sample assessments for first term
    const sampleAssessments = [];
    const allStudents = [...mainStudents, ...eastStudents];

    for (const student of allStudents) {
      for (const subject of allSubjects.slice(0, 3)) { // Math, English, Science only
        sampleAssessments.push({
          studentId: student.id,
          subjectId: subject.id,
          classId: student.classId,
          term: "First Term",
          session: "2024/2025",
          firstCA: Math.floor(Math.random() * 16) + 5, // 5-20
          secondCA: Math.floor(Math.random() * 16) + 5, // 5-20
          exam: Math.floor(Math.random() * 41) + 20, // 20-60
          total: 0, // Will be calculated
          grade: "A"
        });
      }
    }

    // Calculate totals and grades
    sampleAssessments.forEach(assessment => {
      const total = (assessment.firstCA || 0) + (assessment.secondCA || 0) + (assessment.exam || 0);
      assessment.total = total;
      assessment.grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
    });

    await db.insert(assessments).values(sampleAssessments);
    console.log("✓ Created sample assessments");

    // Create default report card template
    await db.insert(reportCardTemplates).values([
      {
        name: "Sunshine Academy Default Template",
        schoolName: "Sunshine Academy",
        schoolAddress: "Education Excellence Center",
        headerConfig: JSON.stringify({
          showLogo: true,
          showSession: true,
          showTerm: true
        }),
        gradesConfig: JSON.stringify({
          A: { min: 80, max: 100, remark: "Excellent" },
          B: { min: 70, max: 79, remark: "Very Good" },
          C: { min: 60, max: 69, remark: "Good" },
          D: { min: 50, max: 59, remark: "Fair" },
          F: { min: 0, max: 49, remark: "Poor" }
        }),
        footerConfig: JSON.stringify({
          principalName: "Dr. Sarah Johnson",
          showSignature: true
        }),
        isDefault: true
      }
    ]);
    console.log("✓ Created report card template");

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📚 Demo Accounts Created:");
    console.log("=".repeat(50));
    console.log("Main Admin (Access to all schools):");
    console.log("  Email: admin@sunshine-academy.edu");
    console.log("  Password: password123");
    console.log("  Role: admin");
    console.log("");
    console.log("Sub-Admins (School-specific access):");
    console.log("  East Branch: east.admin@sunshine-academy.edu");
    console.log("  West Branch: west.admin@sunshine-academy.edu");
    console.log("  North Branch: north.admin@sunshine-academy.edu");
    console.log("  Main Campus: main.admin@sunshine-academy.edu");
    console.log("  Password: password123");
    console.log("  Role: sub-admin");
    console.log("");
    console.log("Sample Students:");
    console.log("  john.doe@student.com (Main Campus)");
    console.log("  jane.smith@student.com (Main Campus)");
    console.log("  alice.wilson@student.com (East Branch)");
    console.log("  Password: password123");
    console.log("  Role: student");
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedDatabase };