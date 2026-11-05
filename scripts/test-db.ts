import { db } from '../src/lib/db';

async function testConnection() {
  try {
    console.log("Checking database connection...");
    const userCount = await db.user.count();
    console.log("Database connection SUCCESS! Total users:", userCount);
  } catch (error) {
    console.error("Database connection FAILED:", error);
  } finally {
    await db.$disconnect();
  }
}

testConnection();
