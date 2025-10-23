import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendOTPEmail = async (to, otp, type = "register") => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false, // ใช้ TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const subject =
    type === "register" ? "ยืนยันอีเมล์สำหรับลงทะเบียน" : "OTP สำหรับรีเซ็ตรหัสผ่าน";

  const text = `รหัส OTP ของคุณคือ: ${otp}. ใช้งานได้ 10 นาที`;

  const info = await transporter.sendMail({
    from: `"Shuttle System" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });

  console.log("Sent OTP:", info.messageId);
  return info;
};
