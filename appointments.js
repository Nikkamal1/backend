// appointments.js
import { db, getConnection } from "./db.js";

// ดึงรายการการจอง
export async function getAppointments(userId, roleId) {
  if (roleId === 1) {
    const [rows] = await db.query(
      `SELECT a.*, h.name AS hospital_name
       FROM appointments a
       JOIN hospitals h ON a.hospital_id = h.id
       WHERE a.user_id=? 
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [userId]
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT a.*, h.name AS hospital_name
     FROM appointments a
     JOIN hospitals h ON a.hospital_id = h.id
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`
  );
  return rows;
}

// ดูรายละเอียด
export async function getAppointmentDetail(appointmentId) {
  const [rows] = await db.query(
    `SELECT a.*, h.name AS hospital_name
     FROM appointments a
     JOIN hospitals h ON a.hospital_id = h.id
     WHERE a.id=?`,
    [appointmentId]
  );
  return rows[0];
}

// แก้ไข
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

// อนุมัติ / ยกเลิก (admin)
export async function updateAppointmentStatus(adminId, appointmentId, newStatus) {
  const [[admin]] = await db.query(`SELECT role_id FROM users WHERE id=?`, [adminId]);
  if (!admin || admin.role_id !== 3) throw new Error("คุณไม่มีสิทธิ์แก้ไขสถานะ");

  if (!["รออนุมัติ","อนุมัติแล้ว","ยกเลิก"].includes(newStatus)) throw new Error("สถานะไม่ถูกต้อง");

  await db.query(`UPDATE appointments SET status=? WHERE id=?`, [newStatus, appointmentId]);
  return true;
}
