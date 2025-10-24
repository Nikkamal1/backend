// db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// สำหรับ async/await ใช้ getConnection() สร้าง connection
export async function getConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      charset: 'utf8mb4',
      timezone: '+07:00',
      // Add timeout settings for Railway
      connectTimeout: 10000, // 10 seconds
      acquireTimeout: 10000, // 10 seconds
      timeout: 10000 // 10 seconds
    });
    
    
    return connection;
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    throw err;
  }
}

// ถ้าต้องการใช้ connection เดียวสำหรับหลายไฟล์
export const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  charset: 'utf8mb4',
  timezone: '+07:00'
});
async function checkThai() {
  const [rows] = await db.query('SELECT first_name, hospital, status FROM appointments LIMIT 5;');
  console.log(rows);
}

checkThai();

// ตั้งค่า charset สำหรับ connection หลัก
db.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
db.query("SET CHARACTER SET utf8mb4");
console.log("✅ Connected to MySQL (db)");
