import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getConnection } from "./db.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { locations } from "./locations.js";
import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import lineRoutes from "./routes/lineRoutes.js";
import lineService from "./services/lineService.js";

dotenv.config();
const app = express();

// CORS configuration - รองรับทั้ง Local และ Production
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = process.env.RAILWAY_PUBLIC_DOMAIN;

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:5174", 
  "http://localhost:5175",
  "http://localhost:5176",
  "https://frontend-production-a002.up.railway.app"
];

// เพิ่ม Production domains
if (isProduction || isRailway) {
  // เพิ่ม Railway domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  
  // เพิ่ม custom domain ถ้ามี
  if (process.env.CUSTOM_DOMAIN) {
    allowedOrigins.push(`https://${process.env.CUSTOM_DOMAIN}`);
  }
  
  // เพิ่ม Frontend production domain
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('https://')) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
}

app.use(cors({ 
  origin: allowedOrigins,
  credentials: true 
}));

// CORS logging for debugging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🌐 CORS Request from: ${origin}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
  console.log(`🔍 Origin allowed:`, allowedOrigins.includes(origin));
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// ==================== Nodemailer ====================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ==================== Users ====================
// ดึงผู้ใช้ทั้งหมด (สำหรับ Staff เลือก)
app.get("/users", async (req, res) => {
  try {
    const connection = await getConnection();
    const [users] = await connection.query(
      "SELECT id, name, email FROM users WHERE role_id = 1 AND is_active = 1"
    );
    await connection.end();
    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ดึงผู้ใช้ทั้งหมด (สำหรับ Admin จัดการ)
app.get("/admin/users", async (req, res) => {
  try {
    const connection = await getConnection();
    const [users] = await connection.query(
      "SELECT id, name, email, role_id, is_active, created_at FROM users ORDER BY created_at DESC"
    );
    await connection.end();
    res.json(users);
  } catch (err) {
    console.error("Get all users error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// อัปเดตข้อมูลผู้ใช้ (สำหรับ Admin)
app.put("/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role_id, is_active } = req.body;
    const connection = await getConnection();

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const [[user]] = await connection.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    }

    // อัปเดตข้อมูล
    await connection.query(
      "UPDATE users SET name = ?, email = ?, role_id = ?, is_active = ? WHERE id = ?",
      [name, email, role_id, is_active, id]
    );

    await connection.end();
    res.json({ success: true, message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// เพิ่มผู้ใช้ใหม่ (สำหรับ Admin)
app.post("/admin/users", async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    const connection = await getConnection();

    // ตรวจสอบว่าอีเมลซ้ำหรือไม่
    const [[existing]] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing) {
      await connection.end();
      return res.status(400).json({ success: false, message: "อีเมล์นี้มีผู้ใช้งานแล้ว" });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // เพิ่มผู้ใช้ใหม่
    const [result] = await connection.query(
      "INSERT INTO users (name, email, password, role_id, is_active) VALUES (?, ?, ?, ?, 1)",
      [name, email, hashedPassword, role_id]
    );

    await connection.end();
    res.json({ success: true, message: "เพิ่มผู้ใช้สำเร็จ", userId: result.insertId });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ลบผู้ใช้ (สำหรับ Admin)
app.delete("/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const [[user]] = await connection.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    }

    // ลบผู้ใช้
    await connection.query("DELETE FROM users WHERE id = ?", [id]);

    await connection.end();
    res.json({ success: true, message: "ลบผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// ==================== Locations ====================
app.get("/locations", (req, res) => {
  res.json(locations);
});

// ==================== LINE Integration ====================
app.use("/api/line", lineRoutes);

// ==================== Login ====================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const connection = await getConnection();
    const [[user]] = await connection.query(`SELECT * FROM users WHERE email = ?`, [email]);

    if (!user) {
      await connection.end();
      return res.status(400).json({ success: false, message: "ไม่พบผู้ใช้งาน" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await connection.end();
      return res.status(400).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    }

    let roleLabel = "user";
    if (user.role_id === 2) roleLabel = "staff";
    if (user.role_id === 3) roleLabel = "admin";

    await connection.end();

    res.json({
      success: true,
      message: "ล็อกอินสำเร็จ",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleLabel,
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== Register ====================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const connection = await getConnection();

    const [[existing]] = await connection.query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (existing) {
      await connection.end();
      return res.status(400).json({ success: false, message: "อีเมล์นี้มีผู้ใช้งานแล้ว" });
    }

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
      text: `รหัส OTP ของคุณคือ ${otp} (ใช้ได้ 10 นาที)`,
    });

    await connection.end();
    res.json({ success: true, message: "ส่ง OTP ไปยังอีเมล์เรียบร้อย" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== Verify OTP ====================
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otpInput } = req.body;
    const connection = await getConnection();

    const [[user]] = await connection.query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user) {
      await connection.end();
      return res.status(400).json({ success: false, message: "ไม่พบผู้ใช้งาน" });
    }

    const [[otpRow]] = await connection.query(
      `SELECT * FROM email_otps WHERE user_id = ? AND otp = ? AND type='register' AND is_used=0 AND expires_at>NOW()`,
      [user.id, otpInput]
    );

    if (!otpRow) {
      await connection.end();
      return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้องหรือหมดอายุ" });
    }

    await connection.query(`UPDATE users SET is_active=1 WHERE id=?`, [user.id]);
    await connection.query(`UPDATE email_otps SET is_used=1 WHERE id=?`, [otpRow.id]);

    await connection.end();
    res.json({ success: true, message: "ยืนยัน OTP สำเร็จ" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== Profile ====================
app.get("/profile/:id", async (req, res) => {
  const { id } = req.params;
  const connection = await getConnection();
  const [[user]] = await connection.query("SELECT id, name, email FROM users WHERE id = ?", [id]);
  await connection.end();
  res.json(user);
});

app.put("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, type, currentPassword, newPassword } = req.body;
    const connection = await getConnection();

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const [[user]] = await connection.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    }

    if (type === 'password') {
      // อัปเดตรหัสผ่าน
      if (!currentPassword || !newPassword) {
        await connection.end();
        return res.status(400).json({ success: false, message: "กรุณาระบุรหัสผ่านปัจจุบันและรหัสผ่านใหม่" });
      }

      // ตรวจสอบรหัสผ่านปัจจุบัน
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        await connection.end();
        return res.status(400).json({ success: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      }

      // เข้ารหัสรหัสผ่านใหม่
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await connection.query("UPDATE users SET password=? WHERE id=?", [hashedPassword, id]);
      
      await connection.end();
      res.json({ success: true, message: "อัปเดตรหัสผ่านสำเร็จ" });
    } else if (type === 'delete') {
      // ลบบัญชี (soft delete)
      await connection.query("UPDATE users SET is_active=0 WHERE id=?", [id]);
      
      await connection.end();
      res.json({ success: true, message: "ลบบัญชีสำเร็จ" });
    } else {
      // อัปเดตข้อมูลทั่วไป
      if (!name || !email) {
        await connection.end();
        return res.status(400).json({ success: false, message: "กรุณาระบุชื่อและอีเมล" });
      }

      // ตรวจสอบอีเมลซ้ำ (ยกเว้นตัวเอง)
      const [[existing]] = await connection.query("SELECT * FROM users WHERE email = ? AND id != ?", [email, id]);
      if (existing) {
        await connection.end();
        return res.status(400).json({ success: false, message: "อีเมลนี้มีผู้ใช้งานแล้ว" });
      }

      await connection.query("UPDATE users SET name=?, email=? WHERE id=?", [name, email, id]);
      
      await connection.end();
      res.json({ success: true, message: "อัปเดตข้อมูลสำเร็จ" });
    }
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== Appointments =================== //
function mapLocationIdsToNames(data, provinces, districts, subdistricts, hospitals) {
  const provinceName = provinces.find(p => String(p.id) === String(data.provinceId))?.name_th || "";
  const districtName = districts.find(d => String(d.id) === String(data.districtId))?.name_th || "";
  const subdistrictName = subdistricts.find(s => String(s.id) === String(data.subdistrictId))?.name_th || "";
  const hospitalName = hospitals.find(h => String(h.id) === String(data.hospitalId))?.name || "";
  return { provinceName, districtName, subdistrictName, hospitalName };
}


app.post("/appointments/user/:userId", async (req, res) => {
  try {
    const payload = req.body; // ประกาศ payload ก่อนใช้งาน
    const { userId } = req.params;
    const connection = await getConnection();

    // Debug logs (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log("Status being inserted:", `"${"รอการอนุมัติ"}"`);
      console.log("Payload:", payload);
    }

    // ดึงชื่อจังหวัด/อำเภอ/ตำบล/โรงพยาบาลจาก payload
    const provinceName = payload.provinceName;
    const districtName = payload.districtName;
    const subdistrictName = payload.subdistrictName;
    const hospitalName = payload.hospitalName;

    const [result] = await connection.query(
      `INSERT INTO appointments (
        user_id, first_name, last_name, phone,
        province, district, subdistrict, hospital,
        appointment_date, appointment_time, latitude, longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.firstName,
        payload.lastName,
        payload.phone,
        provinceName,
        districtName,
        subdistrictName,
        hospitalName,
        payload.appointmentDate,
        payload.appointmentTime,
        payload.latitude,
        payload.longitude,
        payload.status || "รอการอนุมัติ",
      ]
    );

    await connection.end();
    res.json({ success: true, appointmentId: result.insertId });
  } catch (err) {
    console.error("Create appointment (user) error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== Create Appointment (Staff) =================== //
app.post("/appointments/staff", async (req, res) => {
  try {
    const payload = req.body;
    const connection = await getConnection();

    // ตรวจสอบว่า staff ส่งข้อมูลผู้ใช้คนไหน
    if (!payload.userId) {
      await connection.end();
      return res.status(400).json({ success: false, message: "ต้องระบุ userId ของผู้ใช้ที่จองแทน" });
    }

    // แสดงข้อมูลที่รับมาเพื่อดีบัก
    // Debug logs (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log("Staff creating appointment for user:", payload.userId);
      console.log("Payload:", payload);
    }

    // ✅ ใช้ชื่อจังหวัด/อำเภอ/ตำบล/โรงพยาบาลจาก payload
    const provinceName = payload.provinceName;
    const districtName = payload.districtName;
    const subdistrictName = payload.subdistrictName;
    const hospitalName = payload.hospitalName;

    // ✅ แปลงวันที่ให้อยู่ในรูปแบบ YYYY-MM-DD
    const formattedDate = new Date(payload.appointmentDate)
      .toISOString()
      .split("T")[0];

    const [result] = await connection.query(
      `INSERT INTO appointments (
        user_id, first_name, last_name, phone,
        province, district, subdistrict, hospital,
        appointment_date, appointment_time, latitude, longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.userId,
        payload.fullName || payload.firstName || "",
        payload.lastName || "",
        payload.phone,
        provinceName,
        districtName,
        subdistrictName,
        hospitalName,
        formattedDate,
        payload.appointmentTime,
        payload.latitude || null,
        payload.longitude || null,
        payload.status || "รอการอนุมัติ",
      ]
    );

    await connection.end();
    res.json({ success: true, appointmentId: result.insertId });
  } catch (err) {
    console.error("Create appointment (staff) error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



// =================== Update / Staff / Admin =================== //
// Update, Staff, Admin routes เหมือนเดิม ไม่ต้องเปลี่ยนแปลงชื่อคอลัมน์

// Update appointment
app.put("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const connection = await getConnection();

    // ตรวจสอบการจองก่อน
    const [[appointment]] = await connection.query(
      "SELECT * FROM appointments WHERE id = ?",
      [id]
    );

    if (!appointment) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบการจอง" });
    }

    // ตรวจสอบสถานะ
    if (appointment.status !== "รอการอนุมัติ") {
      await connection.end();
      return res
        .status(400)
        .json({ success: false, message: "ไม่สามารถแก้ไขได้ เนื่องจากสถานะไม่ใช่ 'รอการอนุมัติ'" });
    }

    // ✅ แปลงวันที่ให้อยู่ในรูปแบบ YYYY-MM-DD
    const formattedDate = new Date(
      data.appointment_date || data.appointmentDate
    )
      .toISOString()
      .split("T")[0];

    // ✅ ตรวจสอบค่าตัวเลข (latitude, longitude)
    const latitude = parseFloat(data.latitude) || null;
    const longitude = parseFloat(data.longitude) || null;

    // ✅ อัปเดตข้อมูล
    await connection.query(
      `UPDATE appointments SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        province = ?,
        district = ?,
        subdistrict = ?,
        hospital = ?,
        appointment_date = ?,
        appointment_time = ?,
        latitude = ?,
        longitude = ?
       WHERE id = ?`,
      [
        data.fullName || data.first_name || data.firstName || "",
        data.last_name || data.lastName || "",
        data.phone,
        data.province,
        data.district,
        data.subdistrict,
        data.hospital,
        formattedDate,
        data.appointment_time || data.appointmentTime,
        latitude,
        longitude,
        Number(id),
      ]
    );

    await connection.end();
    res.json({ success: true, message: "แก้ไขการจองสำเร็จ" });
  } catch (err) {
    console.error("Update appointment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



// Admin update status (simplified)
app.put("/admin/appointments/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const connection = await getConnection();

    // ตรวจสอบสถานะที่อนุญาต
    if (!["รอการอนุมัติ", "อนุมัติแล้ว", "ยกเลิกการจอง"].includes(status)) {
      await connection.end();
      return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
    }

    // ตรวจสอบว่าการจองมีอยู่จริง
    const [[appointment]] = await connection.query("SELECT * FROM appointments WHERE id = ?", [id]);
    if (!appointment) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบการจอง" });
    }

    // อัปเดตสถานะ
    await connection.query("UPDATE appointments SET status=? WHERE id=?", [status, id]);

    await connection.end();
    
    // ส่งการแจ้งเตือนผ่าน LINE
    try {
      let notificationType;
      if (status === 'อนุมัติแล้ว') {
        notificationType = 'appointment_approved';
      } else if (status === 'ยกเลิกการจอง') {
        notificationType = 'appointment_rejected';
      }
      
      if (notificationType) {
        await lineService.sendAppointmentNotification(appointment.user_id, id, notificationType);
      }
    } catch (lineError) {
      console.error('LINE notification error:', lineError);
      // ไม่ส่ง error กลับไป เพราะการอัปเดตสถานะสำเร็จแล้ว
    }
    
    res.json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
  } catch (err) {
    console.error("Update appointment status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin update status (legacy - keep for backward compatibility)
app.put("/appointments/status/:adminId/:appointmentId", async (req, res) => {
  try {
    const { adminId, appointmentId } = req.params;
    const { newStatus } = req.body;
    const connection = await getConnection();

    const [[admin]] = await connection.query("SELECT role_id FROM users WHERE id=?", [adminId]);
    if (!admin || admin.role_id !== 3) {
      await connection.end();
      return res.status(403).json({ success: false, message: "คุณไม่มีสิทธิ์แก้ไขสถานะ" });
    }

    if (!["รอการอนุมัติ", "อนุมัติแล้ว", "ยกเลิกการจอง"].includes(newStatus)) {
      await connection.end();
      return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
    }

    await connection.query("UPDATE appointments SET status=? WHERE id=?", [newStatus, appointmentId]);

    await connection.end();
    res.json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
  } catch (err) {
    console.error("Update appointment status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== All Appointments (Staff/Admin) =================== //
app.get("/appointments", async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '' } = req.query;
    const connection = await getConnection();

    // Build WHERE clause
    let whereClause = "1=1";
    let params = [];

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    if (search) {
      whereClause += " AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR hospital LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM appointments WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get appointments with pagination
    const [appointments] = await connection.query(
      `SELECT id, user_id, first_name, last_name, phone, province, district, subdistrict, hospital, 
              appointment_date, appointment_time, latitude, longitude, status, created_at
       FROM appointments 
       WHERE ${whereClause}
       ORDER BY appointment_date DESC, appointment_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    await connection.end();
    res.json({
      appointments,
      total,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("Get all appointments error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== User Appointments =================== //
app.get("/appointments/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await getConnection();

    const [appointments] = await connection.query(
      `SELECT id, first_name, last_name, phone, province, district, subdistrict, hospital, 
              appointment_date, appointment_time, latitude, longitude, status, created_at
       FROM appointments 
       WHERE user_id = ?
       ORDER BY appointment_date DESC, appointment_time DESC`,
      [userId]
    );

    await connection.end();
    res.json(appointments);
  } catch (err) {
    console.error("Get user appointments error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Note: Duplicate route removed - using the first PUT /appointments/:id route above


// =================== Get single appointment =================== //
app.get("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    const [[appointment]] = await connection.query(
      `SELECT id, first_name, last_name, phone, province, district, subdistrict, hospital, 
              appointment_date, appointment_time, latitude, longitude, status, created_at
       FROM appointments 
       WHERE id = ?`,
      [id]
    );

    await connection.end();

    if (!appointment) {
      return res.status(404).json({ success: false, message: "ไม่พบการจอง" });
    }

    res.json(appointment);
  } catch (err) {
    console.error("Get appointment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== Delete Appointment =================== //
app.delete("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await getConnection();

    // ตรวจสอบว่าการจองมีอยู่จริง
    const [[appointment]] = await connection.query(
      "SELECT * FROM appointments WHERE id = ?",
      [id]
    );

    if (!appointment) {
      await connection.end();
      return res.status(404).json({ success: false, message: "ไม่พบการจอง" });
    }

    // ตรวจสอบสถานะ - อนุญาตให้ลบได้เฉพาะการจองที่ยังรอการอนุมัติ
    if (appointment.status !== "รอการอนุมัติ") {
      await connection.end();
      return res.status(400).json({ 
        success: false, 
        message: "ไม่สามารถลบได้ เนื่องจากสถานะไม่ใช่ 'รอการอนุมัติ'" 
      });
    }

    // ลบการจอง
    await connection.query("DELETE FROM appointments WHERE id = ?", [id]);

    await connection.end();
    res.json({ success: true, message: "ลบการจองสำเร็จ" });
  } catch (err) {
    console.error("Delete appointment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ดึงรายชื่อจังหวัด
app.get("/locations/provinces", async (req, res) => {
  const connection = await getConnection();
  const [provinces] = await connection.query(
    "SELECT DISTINCT province AS name FROM appointments ORDER BY province"
  );
  await connection.end();
  res.json(provinces.map(p => p.name));
});

// ดึงรายชื่ออำเภอตามจังหวัด
app.get("/locations/districts/:province", async (req, res) => {
  const { province } = req.params;
  const connection = await getConnection();
  const [districts] = await connection.query(
    "SELECT DISTINCT district AS name FROM appointments WHERE province = ? ORDER BY district",
    [province]
  );
  await connection.end();
  res.json(districts.map(d => d.name));
});

// ดึงรายชื่อตำบลตามอำเภอ
app.get("/locations/subdistricts/:district", async (req, res) => {
  const { district } = req.params;
  const connection = await getConnection();
  const [subdistricts] = await connection.query(
    "SELECT DISTINCT subdistrict AS name FROM appointments WHERE district = ? ORDER BY subdistrict",
    [district]
  );
  await connection.end();
  res.json(subdistricts.map(s => s.name));
});

// ดึงรายชื่อโรงพยาบาล
app.get("/locations/hospitals", async (req, res) => {
  const connection = await getConnection();
  const [hospitals] = await connection.query(
    "SELECT DISTINCT hospital AS name FROM appointments ORDER BY hospital"
  );
  await connection.end();
  res.json(hospitals.map(h => h.name));
});

// =================== Statistics & Reports =================== //
// สถิติการจองตามช่วงเวลา
app.get("/admin/statistics", async (req, res) => {
  try {
    const { period = 'month' } = req.query; // day, week, month, year
    const connection = await getConnection();

    let dateFilter = "";
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter = "DATE(appointments.created_at) = CURDATE()";
        break;
      case 'week':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
        break;
      case 'month':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        break;
      case 'year':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        break;
      default:
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
    }

    // สถิติการจอง
    const [appointmentStats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'รอการอนุมัติ' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'อนุมัติแล้ว' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'ยกเลิกการจอง' THEN 1 ELSE 0 END) as cancelled
      FROM appointments 
      WHERE ${dateFilter}
    `);

    // สถิติผู้ใช้
    const [userStats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as regular_users,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as staff_users,
        SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as admin_users
      FROM users 
      WHERE is_active = 1
    `);

    // การจองตามวันในสัปดาห์
    const [weeklyStats] = await connection.query(`
      SELECT 
        DAYNAME(appointment_date) as day_name,
        COUNT(*) as count
      FROM appointments 
      WHERE ${dateFilter}
      GROUP BY DAYOFWEEK(appointment_date), DAYNAME(appointment_date)
      ORDER BY DAYOFWEEK(appointment_date)
    `);

    await connection.end();
    
    res.json({
      success: true,
      data: {
        period,
        appointments: appointmentStats[0],
        users: userStats[0],
        weeklyDistribution: weeklyStats
      }
    });
  } catch (err) {
    console.error("Get statistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =================== System Health Check =================== //
app.get("/health", async (req, res) => {
  try {
    const connection = await getConnection();
    
    // ตรวจสอบการเชื่อมต่อฐานข้อมูล
    const [result] = await connection.query("SELECT 1 as health_check");
    await connection.end();
    
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        api: "running",
        email: process.env.EMAIL_HOST ? "configured" : "not_configured"
      }
    });
  } catch (err) {
    console.error("Health check error:", err);
    res.status(500).json({
      success: false,
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});


// =================== PDF Report Generation =================== //
app.get("/admin/reports/pdf", async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    console.log("PDF Report Request - Period:", period);
    
    
    const connection = await getConnection();

    // ดึงข้อมูลสถิติ
    let dateFilter = "";
    switch (period) {
      case 'day':
        dateFilter = "DATE(appointments.created_at) = CURDATE()";
        break;
      case 'week':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
        break;
      case 'month':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        break;
      case 'year':
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        break;
      default:
        dateFilter = "appointments.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
    }

    // สถิติการจอง
    const [appointmentStats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'รอการอนุมัติ' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'อนุมัติแล้ว' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'ยกเลิกการจอง' THEN 1 ELSE 0 END) as cancelled
      FROM appointments 
      WHERE ${dateFilter}
    `);

    // สถิติผู้ใช้
    const [userStats] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as regular_users,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as staff_users,
        SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as admin_users
      FROM users 
      WHERE is_active = 1
    `);

    // การจองล่าสุด
    const [recentAppointments] = await connection.query(`
      SELECT 
        a.id, a.first_name, a.last_name, a.phone, a.hospital,
        a.appointment_date, a.appointment_time, a.status, a.created_at,
        u.name as user_name
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ${dateFilter.replace('appointments.created_at', 'a.created_at')}
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    await connection.end();


    // สร้าง PDF แบบง่าย
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('รายงานระบบจองรถรับ-ส่งโรงพยาบาล', 20, 20);
    
    // Report Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const periodText = {
      'day': 'รายงานประจำวัน',
      'week': 'รายงานประจำสัปดาห์', 
      'month': 'รายงานประจำเดือน',
      'year': 'รายงานประจำปี'
    };
    
    doc.text(periodText[period] || 'รายงานประจำเดือน', 20, 35);
    doc.text(`วันที่สร้างรายงาน: ${new Date().toLocaleDateString('th-TH')}`, 20, 45);
    doc.text(`เวลา: ${new Date().toLocaleTimeString('th-TH')}`, 20, 55);

    // สถิติการจอง
    let yPos = 75;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('สถิติการจอง', 20, yPos);
    
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const stats = appointmentStats[0];
    doc.text(`• การจองทั้งหมด: ${stats.total} รายการ`, 30, yPos);
    yPos += 10;
    doc.text(`• รอการอนุมัติ: ${stats.pending} รายการ`, 30, yPos);
    yPos += 10;
    doc.text(`• อนุมัติแล้ว: ${stats.approved} รายการ`, 30, yPos);
    yPos += 10;
    doc.text(`• ยกเลิก: ${stats.cancelled} รายการ`, 30, yPos);

    // สถิติผู้ใช้
    yPos += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('สถิติผู้ใช้', 20, yPos);
    
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const userStatsData = userStats[0];
    doc.text(`• ผู้ใช้ทั้งหมด: ${userStatsData.total} คน`, 30, yPos);
    yPos += 10;
    doc.text(`• ผู้ใช้ทั่วไป: ${userStatsData.regular_users} คน`, 30, yPos);
    yPos += 10;
    doc.text(`• เจ้าหน้าที่: ${userStatsData.staff_users} คน`, 30, yPos);
    yPos += 10;
    doc.text(`• ผู้ดูแลระบบ: ${userStatsData.admin_users} คน`, 30, yPos);

    // การจองล่าสุด
    yPos += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('การจองล่าสุด (20 รายการแรก)', 20, yPos);
    
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Table Header
    doc.setFont('helvetica', 'bold');
    doc.text('ID', 20, yPos);
    doc.text('ชื่อ-นามสกุล', 30, yPos);
    doc.text('โรงพยาบาล', 80, yPos);
    doc.text('วันที่', 130, yPos);
    doc.text('สถานะ', 160, yPos);
    
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    
    recentAppointments.slice(0, 20).forEach((apt, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(apt.id.toString(), 20, yPos);
      doc.text(`${apt.first_name} ${apt.last_name}`, 30, yPos);
      doc.text(apt.hospital || 'ไม่ระบุ', 80, yPos);
      doc.text(new Date(apt.appointment_date).toLocaleDateString('th-TH'), 130, yPos);
      doc.text(apt.status, 160, yPos);
      
      yPos += 8;
    });

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('ระบบจองรถรับ-ส่งโรงพยาบาล | สร้างโดยระบบอัตโนมัติ', 20, 280);

    // ส่งไฟล์ PDF
    const fileName = `report_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // ใช้ base64 encoding แทน arraybuffer
    const pdfBase64 = doc.output('datauristring');
    const pdfBuffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ 
      success: false, 
      message: "ไม่สามารถสร้างรายงาน PDF ได้",
      error: err.message
    });
  }
});


const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
