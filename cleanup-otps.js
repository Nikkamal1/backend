import { getConnection } from "./db.js";

// ==================== Cleanup Expired OTPs ====================
async function cleanupExpiredOTPs() {
  try {
    console.log("🧹 Starting OTP cleanup...");
    const connection = await getConnection();
    
    // ลบ OTP ที่หมดอายุแล้ว (ทั้งที่ใช้แล้วและยังไม่ใช้)
    const [result] = await connection.query(
      `DELETE FROM email_otps WHERE expires_at < NOW()`
    );
    
    if (result.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${result.affectedRows} expired OTP(s)`);
    } else {
      console.log("🧹 No expired OTPs to clean up");
    }
    
    await connection.end();
    console.log("✅ OTP cleanup completed successfully");
  } catch (err) {
    console.error("❌ Error cleaning up expired OTPs:", err);
    process.exit(1);
  }
}

// รัน cleanup
cleanupExpiredOTPs();
