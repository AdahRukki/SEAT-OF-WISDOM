import { db } from './db';
import { schools } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function createSchools() {
  try {
    console.log('🏫 Creating schools for Seat of Wisdom Academy...');
    
    // Define all 4 schools
    const schoolsData = [
      { name: 'School 1 Ikpoto', address: 'Ikpoto', phone: '', email: '' },
      { name: 'School 2 Bonsaac', address: 'Bonsaac', phone: '', email: '' },
      { name: 'School 3 Akwuofor', address: 'Akwuofor', phone: '', email: '' },
      { name: 'School 4 Akwuose', address: 'Akwuose', phone: '', email: '' }
    ];
    
    for (const schoolData of schoolsData) {
      // Check if school already exists
      const existing = await db
        .select()
        .from(schools)
        .where(eq(schools.name, schoolData.name))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`✓ ${schoolData.name} already exists`);
      } else {
        await db.insert(schools).values(schoolData);
        console.log(`✅ Created ${schoolData.name}`);
      }
    }
    
    console.log('\n📋 All schools:');
    const allSchools = await db.select().from(schools);
    allSchools.forEach(school => {
      console.log(`  - ${school.name} (${school.address})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createSchools();
