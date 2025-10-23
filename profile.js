// server/profile.js
import bcrypt from "bcryptjs";
import { getConnection } from "./db.js";

// อัปเดตชื่อ และอีเมล์
export async function updateProfile(userId, { name, email }) {
  const connection = await getConnection();

  try {
    const [[user]] = await connection.query(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) return { success: false, message: "ไม่พบผู้ใช้งาน" };

    await connection.query(
      `UPDATE users SET name = ?, email = ? WHERE id = ?`,
      [name || user.name, email || user.email, userId]
    );

    return { success: true, message: "อัปเดตโปรไฟล์สำเร็จ" };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  } finally {
    await connection.end();
  }
}

// เปลี่ยนรหัสผ่าน
export async function changePassword(userId, currentPassword, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) {
    return { success: false, message: "รหัสผ่านใหม่ไม่ตรงกัน" };
  }

  const connection = await getConnection();

  try {
    const [[user]] = await connection.query(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) return { success: false, message: "ไม่พบผู้ใช้งาน" };

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return { success: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await connection.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId]);

    return { success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  } finally {
    await connection.end();
  }
}
