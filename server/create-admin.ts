import 'dotenv/config';
import { db } from './db';
import { users, schools } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user for production...');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment. Refusing to create an admin with a hardcoded credential.');
      process.exit(1);
      return;
    }

    // Check if admin already exists
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Get first school (or create a default one)
    let school = await db.select().from(schools).limit(1);

    if (school.length === 0) {
      console.log('📚 Creating default school...');
      const [newSchool] = await db.insert(schools).values({
        name: 'School 1 Ikpoto',
        address: 'Ikpoto',
        phone: '',
        email: ''
      }).returning();
      school = [newSchool];
    }

    // Create admin user
    await db.insert(users).values({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      schoolId: null // Main admin can access all schools
    });

    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log('\n⚠️  Please change this password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
