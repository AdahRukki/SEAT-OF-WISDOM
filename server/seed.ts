import { storage } from "./storage";
import type { InsertUser, InsertClass, InsertSubject, InsertStudent } from "@shared/schema";

async function seedDatabase() {
  console.log("Starting database seeding...");

  try {
    // Create admin user
    const adminUser = await storage.createUser({
      email: "admin@school.com",
      password: "password123",
      firstName: "Admin",
      lastName: "User",
      role: "admin"
    });
    console.log("✓ Admin user created");

    // Create classes
    const class5A = await storage.createClass({
      name: "Grade 5A",
      description: "Primary 5 class A"
    });

    const class5B = await storage.createClass({
      name: "Grade 5B", 
      description: "Primary 5 class B"
    });

    const class6A = await storage.createClass({
      name: "Grade 6A",
      description: "Primary 6 class A"
    });
    console.log("✓ Classes created");

    // Create subjects
    const mathematics = await storage.createSubject({
      name: "Mathematics",
      code: "MATH",
      description: "Basic mathematics and arithmetic"
    });

    const english = await storage.createSubject({
      name: "English Language",
      code: "ENG",
      description: "English language and literature"
    });

    const science = await storage.createSubject({
      name: "Basic Science",
      code: "SCI",
      description: "Introduction to science concepts"
    });

    const socialStudies = await storage.createSubject({
      name: "Social Studies",
      code: "SS",
      description: "History, geography and civics"
    });
    console.log("✓ Subjects created");

    // Assign subjects to classes
    await storage.assignSubjectToClass(class5A.id, mathematics.id);
    await storage.assignSubjectToClass(class5A.id, english.id);
    await storage.assignSubjectToClass(class5A.id, science.id);
    await storage.assignSubjectToClass(class5A.id, socialStudies.id);
    
    await storage.assignSubjectToClass(class5B.id, mathematics.id);
    await storage.assignSubjectToClass(class5B.id, english.id);
    await storage.assignSubjectToClass(class5B.id, science.id);
    
    await storage.assignSubjectToClass(class6A.id, mathematics.id);
    await storage.assignSubjectToClass(class6A.id, english.id);
    await storage.assignSubjectToClass(class6A.id, science.id);
    await storage.assignSubjectToClass(class6A.id, socialStudies.id);
    console.log("✓ Subjects assigned to classes");

    // Create demo students
    const students = [
      {
        user: {
          email: "student@school.com",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
          role: "student" as const
        },
        student: {
          studentId: "STU001",
          classId: class5A.id
        }
      },
      {
        user: {
          email: "jane.smith@school.com",
          password: "password123",
          firstName: "Jane",
          lastName: "Smith",
          role: "student" as const
        },
        student: {
          studentId: "STU002",
          classId: class5A.id
        }
      },
      {
        user: {
          email: "mike.johnson@school.com",
          password: "password123",
          firstName: "Mike",
          lastName: "Johnson",
          role: "student" as const
        },
        student: {
          studentId: "STU003",
          classId: class5B.id
        }
      }
    ];

    for (const studentData of students) {
      const user = await storage.createUser(studentData.user);
      await storage.createStudent({
        ...studentData.student,
        userId: user.id
      });
    }
    console.log("✓ Demo students created");

    // Create some sample assessments
    const studentUser = await storage.getUserById(
      (await storage.createUser({
        email: "demo.student@school.com",
        password: "password123", 
        firstName: "Demo",
        lastName: "Student",
        role: "student"
      })).id
    );

    if (studentUser) {
      const demoStudent = await storage.createStudent({
        userId: studentUser.id,
        studentId: "STU004",
        classId: class5A.id
      });

      // Add some scores
      await storage.createOrUpdateAssessment({
        studentId: demoStudent.id,
        subjectId: mathematics.id,
        classId: class5A.id,
        term: "First Term",
        session: "2024/2025",
        firstCA: "25",
        secondCA: "28",
        exam: "65"
      });

      await storage.createOrUpdateAssessment({
        studentId: demoStudent.id,
        subjectId: english.id,
        classId: class5A.id,
        term: "First Term",
        session: "2024/2025",
        firstCA: "22",
        secondCA: "24",
        exam: "58"
      });

      await storage.createOrUpdateAssessment({
        studentId: demoStudent.id,
        subjectId: science.id,
        classId: class5A.id,
        term: "First Term",
        session: "2024/2025",
        firstCA: "28",
        secondCA: "27",
        exam: "62"
      });

      console.log("✓ Sample assessments created");
    }

    console.log("Database seeding completed successfully!");
    console.log("\nDemo accounts:");
    console.log("Admin: admin@school.com / password123");
    console.log("Student: demo.student@school.com / password123");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };