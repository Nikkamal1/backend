// auth.js
import { db, getConnection } from "./db.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =================== การจัดการผู้ใช้ ===================

// ลงทะเบียน + ส่ง OTP
export async function createUser(name, email, password) {
  const connection = await getConnection();
  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await connection.query(
    `INSERT INTO users (name, email, password, role_id, is_active) VALUES (?, ?, ?, 1, 0)`,
    [name, email, hashedPassword]
  );

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await connection.query(
    `INSERT INTO email_otps (user_id, otp, type, expires_at) VALUES (?, ?, 'register', ?)`,
    [result.insertId, otp, expiresAt]
  );

  await transporter.sendMail({
    from: `"Shuttle System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "OTP ยืนยันอีเมล์",
    text: `รหัส OTP ของคุณคือ ${otp} (ใช้ได้ 10 นาที)`
  });

  await connection.end();
  return { success: true, message: "ส่ง OTP ไปยังอีเมล์เรียบร้อย" };
}

// ตรวจสอบ OTP
export async function verifyRegisterOTP(email, otpInput) {
  const connection = await getConnection();
  const [[user]] = await connection.query(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!user) return { success: false, message: "ไม่พบผู้ใช้งาน" };

  const [[otpRow]] = await connection.query(
    `SELECT * FROM email_otps WHERE user_id = ? AND otp = ? AND type='register' AND is_used=0 AND expires_at>NOW()`,
    [user.id, otpInput]
  );

  if (!otpRow) {
    await connection.end();
    return { success: false, message: "OTP ไม่ถูกต้องหรือหมดอายุ" };
  }

  await connection.query(`UPDATE users SET is_active=1 WHERE id=?`, [user.id]);
  await connection.query(`UPDATE email_otps SET is_used=1 WHERE id=?`, [otpRow.id]);

  await connection.end();
  return { success: true, message: "ยืนยัน OTP สำเร็จ" };
}

// แก้สิทธิ์ (admin เท่านั้น)
export async function updateUserRole(adminId, targetUserId, newRoleId) {
  const connection = await getConnection();
  const [[admin]] = await connection.query(`SELECT role_id FROM users WHERE id=?`, [adminId]);
  if (!admin || admin.role_id !== 3) {
    await connection.end();
    return { success: false, message: "คุณไม่มีสิทธิ์แก้ไขผู้ใช้นี้" };
  }

  await connection.query(`UPDATE users SET role_id=? WHERE id=?`, [newRoleId, targetUserId]);
  await connection.end();
  return { success: true, message: "อัปเดตสิทธิ์สำเร็จ" };
}

// =================== การจัดการการจอง ===================

// สร้างการจอง (user)
export async function createAppointmentUser(userId, data) {
  const { firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, latitude, longitude } = data;

  const [result] = await db.query(
    `INSERT INTO appointments 
    (user_id, first_name, last_name, phone, province_id, district_id, subdistrict_id, hospital_id, appointment_date, appointment_time, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, latitude, longitude, "รออนุมัติ"]
  );

  return result.insertId;
}

// สร้างการจองแทนผู้ใช้คนอื่น (staff)
export async function createAppointmentStaff(staffId, targetUserId, data) {
  const { firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime } = data;

  const [result] = await db.query(
    `INSERT INTO appointments 
    (user_id, first_name, last_name, phone, province_id, district_id, subdistrict_id, hospital_id, appointment_date, appointment_time, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    [targetUserId, firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, "รออนุมัติ"]
  );

  return result.insertId;
}

// แก้ไขการจอง (User / Staff)
export async function updateAppointment(userId, roleId, appointmentId, data) {
  const { firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, latitude, longitude } = data;

  const [[appointment]] = await db.query(`SELECT * FROM appointments WHERE id=?`, [appointmentId]);
  if (!appointment) throw new Error("ไม่พบการจอง");

  if (roleId === 1 && appointment.user_id !== userId) throw new Error("คุณไม่มีสิทธิ์แก้ไขรายการนี้");
  if (roleId === 1 && appointment.status === "ยกเลิก") throw new Error("ไม่สามารถแก้ไขรายการที่ถูกยกเลิกได้");

  if (roleId === 2) {
    await db.query(
      `UPDATE appointments SET first_name=?, last_name=?, phone=?, province_id=?, district_id=?, subdistrict_id=?, hospital_id=?, appointment_date=?, appointment_time=?, latitude=NULL, longitude=NULL
       WHERE id=?`,
      [firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, appointmentId]
    );
    return true;
  }

  await db.query(
    `UPDATE appointments SET first_name=?, last_name=?, phone=?, province_id=?, district_id=?, subdistrict_id=?, hospital_id=?, appointment_date=?, appointment_time=?, latitude=?, longitude=?
     WHERE id=?`,
    [firstName, lastName, phone, provinceId, districtId, subdistrictId, hospitalId, appointmentDate, appointmentTime, latitude, longitude, appointmentId]
  );
  return true;
}

// อนุมัติ / ยกเลิกการจอง (admin)
export async function updateAppointmentStatus(adminId, appointmentId, newStatus) {
  const [[admin]] = await db.query(`SELECT role_id FROM users WHERE id=?`, [adminId]);
  if (!admin || admin.role_id !== 3) throw new Error("คุณไม่มีสิทธิ์แก้ไขสถานะ");

  if (!["รออนุมัติ","อนุมัติแล้ว","ยกเลิก"].includes(newStatus)) throw new Error("สถานะไม่ถูกต้อง");

  await db.query(`UPDATE appointments SET status=? WHERE id=?`, [newStatus, appointmentId]);
  return true;
}

// =================== ฟังก์ชันเสริม ===================

// ตรวจสอบสิทธิ์แก้ไขการจอง
export async function canEditAppointment(userId, roleId, appointmentId) {
  const [[appointment]] = await db.query(`SELECT * FROM appointments WHERE id=?`, [appointmentId]);
  if (!appointment) return false;
  if (roleId === 3) return true; // admin
  if (roleId === 2) return true; // staff
  if (roleId === 1 && appointment.user_id === userId && appointment.status !== "ยกเลิก") return true;
  return false;
}

// ตรวจสอบสิทธิ์ดูพิกัด
export async function canViewLocation(userId, roleId, appointmentId) {
  if (roleId === 1) {
    const [[appointment]] = await db.query(`SELECT * FROM appointments WHERE id=?`, [appointmentId]);
    if (!appointment) return false;
    return appointment.user_id === userId;
  }
  return true; // staff/admin
}

// ดึงรายการพร้อมพิกัด
export async function getAppointmentsWithLocation(userId, roleId) {
  let query = `
    SELECT a.id, a.first_name, a.last_name, a.phone, a.appointment_date, a.appointment_time, a.status, a.latitude, a.longitude, h.name AS hospital_name
    FROM appointments a
    JOIN hospitals h ON a.hospital_id = h.id
  `;
  if (roleId === 1) {
    query += ` WHERE a.user_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    const [rows] = await db.query(query, [userId]);
    return rows;
  }
  query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
  const [rows] = await db.query(query);
  return rows;
}

// ตรวจสอบสิทธิ์แก้ไขสถานะ
export async function canUpdateStatus(userId, roleId) {
  return roleId === 3; // admin เท่านั้น
}
