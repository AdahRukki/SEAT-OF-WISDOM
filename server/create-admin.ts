import 'dotenv/config';
import { db } from './db';
import { users, schools } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user for production...');

    // Check if admin already exists
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.email, 'adahrukki@gmail.com'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('password@123', 10);

    // Get first school (or create a default one)
    let school = await db.select().from(schools).limit(1);
    
    if (school.length === 0) {
      console.log('📚 Creating default school...');
      const [newSchool] = await db.insert(schools).values({
        id: 'SCH1',
        name: 'School 1 Ikpoto',
        address: 'Ikpoto',
        phone: '',
        email: ''
      }).returning();
      school = [newSchool];
    }

    // Create admin user
    await db.insert(users).values({
      email: 'adahrukki@gmail.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      schoolId: null // Main admin can access all schools
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: adahrukki@gmail.com');
    console.log('🔑 Password: password@123');
    console.log('\n⚠️  Please change this password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
