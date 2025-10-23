// lineService.js
import axios from 'axios';
import { getConnection } from '../db.js';

class LineService {
  constructor() {
    this.loginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
    this.loginChannelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    this.messagingChannelId = process.env.LINE_MESSAGING_CHANNEL_ID;
    this.messagingChannelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
    this.messagingAccessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // รองรับทั้ง Local (ngrok) และ Production (Railway)
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isRailway = process.env.RAILWAY_PUBLIC_DOMAIN;
    
    if (this.isProduction || this.isRailway) {
      // Production: ใช้ Railway domain
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        // ตรวจสอบว่า domain มี https:// หรือไม่
        this.baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN.startsWith('https://')
          ? process.env.RAILWAY_PUBLIC_DOMAIN
          : `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      } else if (process.env.CUSTOM_DOMAIN) {
        this.baseUrl = process.env.CUSTOM_DOMAIN.startsWith('https://')
          ? process.env.CUSTOM_DOMAIN
          : `https://${process.env.CUSTOM_DOMAIN}`;
      } else {
        this.baseUrl = process.env.NGROK_URL || 'https://83b3aa05f505.ngrok-free.app';
      }
    } else {
      // Local Development: ใช้ ngrok
      this.baseUrl = process.env.NGROK_URL || 'https://83b3aa05f505.ngrok-free.app';
    }
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 LINE Service Configuration:');
      console.log(`   - isProduction: ${this.isProduction}`);
      console.log(`   - isRailway: ${this.isRailway}`);
      console.log(`   - RAILWAY_PUBLIC_DOMAIN: ${process.env.RAILWAY_PUBLIC_DOMAIN}`);
      console.log(`   - baseUrl: ${this.baseUrl}`);
    }
  }

  // สร้าง URL สำหรับ LINE Login
  generateLineLoginUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.loginChannelId,
      redirect_uri: `${this.baseUrl}/api/line/login-callback`,
      state: state,
      scope: 'profile openid'
    });
    return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  }
  

  // แลกเปลี่ยน authorization code เป็น access token
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post('https://api.line.me/oauth2/v2.1/token', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${this.baseUrl}/api/line/login-callback`,
          client_id: this.loginChannelId,
          client_secret: this.loginChannelSecret
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw error;
    }
  }

  // ดึงข้อมูลโปรไฟล์จาก LINE
  async getLineProfile(accessToken) {
    try {
      const response = await axios.get('https://api.line.me/v2/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting LINE profile:', error.response?.data || error.message);
      throw error;
    }
  }

  // บันทึกการเชื่อมต่อ LINE กับ user
  async saveLineConnection(userId, lineData) {
    const connection = await getConnection();
    
    try {
      // ตรวจสอบว่ามีการเชื่อมต่ออยู่แล้วหรือไม่
      const [existing] = await connection.query(
        'SELECT * FROM user_line_connections WHERE user_id = ? OR line_user_id = ?',
        [userId, lineData.userId]
      );

      if (existing.length > 0) {
        // อัปเดตการเชื่อมต่อที่มีอยู่
        await connection.query(
          `UPDATE user_line_connections SET 
           line_user_id = ?, line_display_name = ?, line_picture_url = ?, 
           access_token = ?, refresh_token = ?, is_active = 1, 
           connected_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
           WHERE user_id = ? OR line_user_id = ?`,
          [
            lineData.userId, lineData.displayName, lineData.pictureUrl,
            lineData.accessToken, lineData.refreshToken, userId, lineData.userId
          ]
        );
      } else {
        // สร้างการเชื่อมต่อใหม่
        await connection.query(
          `INSERT INTO user_line_connections 
           (user_id, line_user_id, line_display_name, line_picture_url, access_token, refresh_token, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            userId, lineData.userId, lineData.displayName, lineData.pictureUrl,
            lineData.accessToken, lineData.refreshToken
          ]
        );
      }

      return true;
    } catch (error) {
      console.error('Error saving LINE connection:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // ดึงข้อมูลการเชื่อมต่อ LINE ของ user
  async getLineConnection(userId) {
    const connection = await getConnection();
    
    try {
      const [connections] = await connection.query(
        'SELECT * FROM user_line_connections WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      
      return connections.length > 0 ? connections[0] : null;
    } catch (error) {
      console.error('Error getting LINE connection:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // ส่งข้อความผ่าน LINE
  async sendMessage(lineUserId, message) {
    try {
      const response = await axios.post('https://api.line.me/v2/bot/message/push', {
        to: lineUserId,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.messagingAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error sending LINE message:', error.response?.data || error.message);
      throw error;
    }
  }

  // ส่งการแจ้งเตือนการจอง
  async sendAppointmentNotification(userId, appointmentId, notificationType) {
    const connection = await getConnection();
    
    try {
      // ดึงข้อมูลการเชื่อมต่อ LINE
      const lineConnection = await this.getLineConnection(userId);
      if (!lineConnection) {
        // Debug log (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log(`User ${userId} has no LINE connection`);
        }
        return false;
      }

      // ดึงข้อมูลการจอง
      const [appointments] = await connection.query(
        'SELECT * FROM appointments WHERE id = ?',
        [appointmentId]
      );
      
      if (appointments.length === 0) {
        throw new Error('Appointment not found');
      }
      
      const appointment = appointments[0];
      
      // สร้างข้อความแจ้งเตือน
      let message = '';
      switch (notificationType) {
        case 'appointment_approved':
          message = `✅ การจองของคุณได้รับการอนุมัติแล้ว!\n\n`;
          message += `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n`;
          message += `🕐 เวลา: ${appointment.appointment_time}\n`;
          message += `🏥 โรงพยาบาล: ${appointment.hospital}\n`;
          message += `📍 ที่อยู่: ${appointment.province} ${appointment.district} ${appointment.subdistrict}`;
          break;
          
        case 'appointment_rejected':
          message = `❌ การจองของคุณถูกปฏิเสธ\n\n`;
          message += `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n`;
          message += `🕐 เวลา: ${appointment.appointment_time}\n`;
          message += `🏥 โรงพยาบาล: ${appointment.hospital}\n\n`;
          message += `กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามรายละเอียดเพิ่มเติม`;
          break;
          
        case 'appointment_cancelled':
          message = `🚫 การจองของคุณถูกยกเลิก\n\n`;
          message += `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n`;
          message += `🕐 เวลา: ${appointment.appointment_time}\n`;
          message += `🏥 โรงพยาบาล: ${appointment.hospital}`;
          break;
          
        default:
          throw new Error('Invalid notification type');
      }

      // ส่งข้อความ
      await this.sendMessage(lineConnection.line_user_id, message);
      
      // บันทึกการแจ้งเตือน
      await connection.query(
        `INSERT INTO line_notifications 
         (user_id, appointment_id, notification_type, message, status) 
         VALUES (?, ?, ?, ?, 'sent')`,
        [userId, appointmentId, notificationType, message]
      );
      
      return true;
    } catch (error) {
      console.error('Error sending appointment notification:', error);
      
      // บันทึกข้อผิดพลาด
      await connection.query(
        `INSERT INTO line_notifications 
         (user_id, appointment_id, notification_type, message, status, error_message) 
         VALUES (?, ?, ?, ?, 'failed', ?)`,
        [userId, appointmentId, notificationType, '', error.message]
      );
      
      return false;
    } finally {
      await connection.end();
    }
  }

  // ยกเลิกการเชื่อมต่อ LINE
  async disconnectLine(userId) {
    const connection = await getConnection();
    
    try {
      await connection.query(
        'UPDATE user_line_connections SET is_active = 0 WHERE user_id = ?',
        [userId]
      );
      
      return true;
    } catch (error) {
      console.error('Error disconnecting LINE:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

export default new LineService();
