import axios from 'axios';
import { getConnection } from '../db.js';

class LineService {
  constructor() {
    this.loginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
    this.loginChannelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    this.messagingChannelId = process.env.LINE_MESSAGING_CHANNEL_ID;
    this.messagingAccessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    this.baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? (process.env.RAILWAY_PUBLIC_DOMAIN.startsWith('https://')
          ? process.env.RAILWAY_PUBLIC_DOMAIN
          : `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
      : 'http://localhost:3001';

    this.callbackUrl =
      process.env.LINE_CALLBACK_URL ||
      `${this.baseUrl}/api/line/login-callback`;

    console.log('🔧 LINE Service Configuration:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - baseUrl: ${this.baseUrl}`);
    console.log(`   - callbackUrl: ${this.callbackUrl}`);
  }

  // ✅ สร้าง URL สำหรับ LINE Login
  generateLineLoginUrl(state) {
    const redirectUri = this.callbackUrl;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.loginChannelId,
      redirect_uri: redirectUri,
      state,
      scope: 'profile openid',
    });

    const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    console.log('🔗 LINE Login URL generated:', loginUrl);
    return loginUrl;
  }

  // ✅ แลก code เป็น token
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://api.line.me/oauth2/v2.1/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.callbackUrl,
          client_id: this.loginChannelId,
          client_secret: this.loginChannelSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ ดึงข้อมูลโปรไฟล์จาก LINE
  async getLineProfile(accessToken) {
    try {
      const response = await axios.get('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data;
    } catch (error) {
      console.error('Error getting LINE profile:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ บันทึกการเชื่อมต่อ LINE กับ user
  async saveLineConnection(userId, lineData) {
    const connection = await getConnection();

    try {
      const [existing] = await connection.query(
        'SELECT * FROM user_line_connections WHERE user_id = ? AND line_user_id = ?',
        [userId, lineData.userId]
      );

      if (existing.length > 0) {
        await connection.query(
          `UPDATE user_line_connections 
           SET line_display_name = ?, line_picture_url = ?, 
               access_token = ?, refresh_token = ?, is_active = 1, 
               last_used_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND line_user_id = ?`,
          [
            lineData.displayName, lineData.pictureUrl,
            lineData.accessToken, lineData.refreshToken,
            userId, lineData.userId,
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO user_line_connections 
           (user_id, line_user_id, line_display_name, line_picture_url, access_token, refresh_token, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            userId, lineData.userId, lineData.displayName, lineData.pictureUrl,
            lineData.accessToken, lineData.refreshToken,
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

  // ✅ ดึงข้อมูลการเชื่อมต่อ LINE ของ user (ทั้งหมด)
  async getLineConnections(userId) {
    const connection = await getConnection();
    try {
      const [connections] = await connection.query(
        'SELECT * FROM user_line_connections WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      return connections;
    } catch (error) {
      console.error('Error getting LINE connections:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // ✅ ยกเลิกการเชื่อมต่อ (บาง LINE หรือทั้งหมด)
  async disconnectLine(userId, lineUserId = null) {
    const connection = await getConnection();
    try {
      if (lineUserId) {
        await connection.query(
          'UPDATE user_line_connections SET is_active = 0 WHERE user_id = ? AND line_user_id = ?',
          [userId, lineUserId]
        );
      } else {
        await connection.query(
          'UPDATE user_line_connections SET is_active = 0 WHERE user_id = ?',
          [userId]
        );
      }
      return true;
    } catch (error) {
      console.error('Error disconnecting LINE:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // ✅ ส่งข้อความผ่าน LINE
  async sendMessage(lineUserId, message) {
    try {
      const response = await axios.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: lineUserId,
          messages: [{ type: 'text', text: message }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.messagingAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending LINE message:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ ส่งการแจ้งเตือนการจอง (หลายไลน์)
  async sendAppointmentNotification(userId, appointmentId, notificationType) {
    const connection = await getConnection();
    try {
      const lineConnections = await this.getLineConnections(userId);
      if (lineConnections.length === 0) {
        console.log(`User ${userId} has no LINE connections`);
        return false;
      }

      const [appointments] = await connection.query(
        'SELECT * FROM appointments WHERE id = ?',
        [appointmentId]
      );
      if (appointments.length === 0) throw new Error('Appointment not found');
      const appointment = appointments[0];

      let message = '';
      switch (notificationType) {
        case 'appointment_approved':
          message = `✅ การจองของคุณได้รับการอนุมัติแล้ว!\n\n` +
                    `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n` +
                    `🕐 เวลา: ${appointment.appointment_time}\n` +
                    `🏥 โรงพยาบาล: ${appointment.hospital}`;
          break;
        case 'appointment_rejected':
          message = `❌ การจองของคุณถูกปฏิเสธ\n\n` +
                    `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n` +
                    `🕐 เวลา: ${appointment.appointment_time}\n` +
                    `🏥 โรงพยาบาล: ${appointment.hospital}`;
          break;
        case 'appointment_cancelled':
          message = `🚫 การจองของคุณถูกยกเลิก\n\n` +
                    `📅 วันที่: ${new Date(appointment.appointment_date).toLocaleDateString('th-TH')}\n` +
                    `🕐 เวลา: ${appointment.appointment_time}\n` +
                    `🏥 โรงพยาบาล: ${appointment.hospital}`;
          break;
        default:
          throw new Error('Invalid notification type');
      }

      // ส่งข้อความให้ทุก LINE ที่เชื่อมอยู่
      for (const conn of lineConnections) {
        await this.sendMessage(conn.line_user_id, message);
      }

      await connection.query(
        `INSERT INTO line_notifications 
         (user_id, appointment_id, notification_type, message, status) 
         VALUES (?, ?, ?, ?, 'sent')`,
        [userId, appointmentId, notificationType, message]
      );

      return true;
    } catch (error) {
      console.error('Error sending appointment notification:', error);
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
}

export default new LineService();
