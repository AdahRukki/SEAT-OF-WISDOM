const bcrypt = require('bcrypt');

// Hash from database for adahr ukevwe@gmail.com
const hash = '$2b$10$UVbgY/s1nQsraE6vZjVIEO.RYJM1ZYS0Adq3F4gosv/Fxm69i3rsu';

// Test passwords
const passwords = ['password@123', 'Password@123', 'password123', '12345678', 'admin123'];

async function testPasswords() {
  console.log('Testing passwords against hash...\n');
  for (const pwd of passwords) {
    const result = await bcrypt.compare(pwd, hash);
    console.log(`Password: "${pwd}" - ${result ? 'MATCH ✓' : 'NO MATCH ✗'}`);
  }
}

testPasswords();
