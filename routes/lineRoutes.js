// lineRoutes.js
import express from 'express';
import lineService from '../services/lineService.js';
import { getConnection } from '../db.js';

const router = express.Router();

// สร้าง URL สำหรับ LINE Login
router.get('/login-url/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // สร้าง state เพื่อป้องกัน CSRF
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
    
    const loginUrl = lineService.generateLineLoginUrl(state);
    
    res.json({
      success: true,
      loginUrl: loginUrl,
      state: state
    });
  } catch (error) {
    console.error('Error generating LINE login URL:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถสร้าง URL สำหรับ LINE Login ได้'
    });
  }
});

// ✅ รองรับ LINE Login redirect แบบ GET
// lineRoutes.js
router.get('/login-callback', async (req, res) => {
    try {
      const { code, state } = req.query;  // GET parameter
      if (!code || !state) return res.status(400).send('Missing code or state');
  
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId } = stateData;
  
      const tokenData = await lineService.exchangeCodeForToken(code);
      const profile = await lineService.getLineProfile(tokenData.access_token);
  
      await lineService.saveLineConnection(userId, {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token
      });
  
      res.redirect(`${process.env.FRONTEND_URL}/line-callback?success=true&message=เชื่อมต่อ LINE สำเร็จ`);
    } catch (error) {
      console.error(error);
      res.redirect(`${process.env.FRONTEND_URL}/line-callback?success=false&message=เกิดข้อผิดพลาดในการเชื่อมต่อ LINE`);
    }
  });
  
  

// จัดการ callback จาก LINE Login
router.post('/login-callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน'
      });
    }
    
    // ตรวจสอบ state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'State ไม่ถูกต้อง'
      });
    }
    
    const { userId } = stateData;
    
    // แลกเปลี่ยน code เป็น access token
    const tokenData = await lineService.exchangeCodeForToken(code);
    
    // ดึงข้อมูลโปรไฟล์
    const profile = await lineService.getLineProfile(tokenData.access_token);
    
    // บันทึกการเชื่อมต่อ
    const lineData = {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    };
    
    await lineService.saveLineConnection(userId, lineData);
    
    res.json({
      success: true,
      message: 'เชื่อมต่อ LINE สำเร็จ',
      profile: {
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl
      }
    });
  } catch (error) {
    console.error('Error handling LINE callback:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ LINE'
    });
  }
});

// ตรวจสอบสถานะการเชื่อมต่อ LINE
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const connection = await lineService.getLineConnection(userId);
    
    if (connection) {
      res.json({
        success: true,
        connected: true,
        profile: {
          displayName: connection.line_display_name,
          pictureUrl: connection.line_picture_url,
          connectedAt: connection.connected_at
        }
      });
    } else {
      res.json({
        success: true,
        connected: false
      });
    }
  } catch (error) {
    console.error('Error checking LINE status:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถตรวจสอบสถานะการเชื่อมต่อ LINE ได้'
    });
  }
});

// ยกเลิกการเชื่อมต่อ LINE
router.post('/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await lineService.disconnectLine(userId);
    
    res.json({
      success: true,
      message: 'ยกเลิกการเชื่อมต่อ LINE สำเร็จ'
    });
  } catch (error) {
    console.error('Error disconnecting LINE:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถยกเลิกการเชื่อมต่อ LINE ได้'
    });
  }
});

// ส่งข้อความทดสอบ
router.post('/test-message/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;
    
    const connection = await lineService.getLineConnection(userId);
    
    if (!connection) {
      return res.status(400).json({
        success: false,
        message: 'ผู้ใช้ยังไม่ได้เชื่อมต่อ LINE'
      });
    }
    
    await lineService.sendMessage(connection.line_user_id, message || 'ข้อความทดสอบจากระบบจองรถรับ-ส่งโรงพยาบาล');
    
    res.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ'
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถส่งข้อความได้'
    });
  }
});

// ดึงประวัติการแจ้งเตือน
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const connection = await getConnection();
    
    const offset = (page - 1) * limit;
    
    const [notifications] = await connection.query(
      `SELECT ln.*, a.first_name, a.last_name, a.hospital, a.appointment_date, a.appointment_time
       FROM line_notifications ln
       LEFT JOIN appointments a ON ln.appointment_id = a.id
       WHERE ln.user_id = ?
       ORDER BY ln.sent_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), offset]
    );
    
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM line_notifications WHERE user_id = ?',
      [userId]
    );
    
    await connection.end();
    
    res.json({
      success: true,
      notifications: notifications,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงประวัติการแจ้งเตือนได้'
    });
  }
});

// LINE Webhook endpoint สำหรับรับข้อความจาก LINE และ LINE Login callback
router.post('/webhook', async (req, res) => {
  try {
    // Debug log (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('📨 Received LINE webhook:', JSON.stringify(req.body, null, 2));
    }
    
    // ตรวจสอบว่าเป็น LINE Login callback หรือ webhook
    if (req.body.code && req.body.state) {
      // LINE Login callback
      // Debug log (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Processing LINE Login callback');
      }
      
      const { code, state } = req.body;
      
      try {
        // แลกเปลี่ยน code เป็น access token
        const tokenData = await lineService.exchangeCodeForToken(code);
        
        // ดึงข้อมูลโปรไฟล์
        const profile = await lineService.getLineProfile(tokenData.access_token);
        
        // ตรวจสอบ state เพื่อหา userId
        let stateData;
        try {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        } catch (error) {
          console.error('Invalid state:', error);
          return res.status(400).json({ success: false, message: 'Invalid state' });
        }
        
        const { userId } = stateData;
        
        // บันทึกการเชื่อมต่อ
        const lineData = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token
        };
        
        await lineService.saveLineConnection(userId, lineData);
        
        // Redirect กลับไปที่ frontend
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/line-callback?success=true&message=เชื่อมต่อ LINE สำเร็จ`);
        
      } catch (error) {
        console.error('LINE Login callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/line-callback?success=false&message=เกิดข้อผิดพลาดในการเชื่อมต่อ LINE`);
      }
      
    } else if (req.body.events) {
      // LINE Messaging API webhook
      // Debug log (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('💬 Processing LINE Messaging API webhook');
      }
      
      const events = req.body.events;
      
      if (!events || events.length === 0) {
        return res.status(200).json({ success: true, message: 'No events' });
      }
      
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          // Debug log (remove in production)
          if (process.env.NODE_ENV === 'development') {
            console.log(`📝 Received message from ${event.source.userId}: ${event.message.text}`);
          }
          
          // ตอบกลับข้อความอัตโนมัติ
          await lineService.sendMessage(event.source.userId, 'ขอบคุณสำหรับข้อความ! ระบบจะตอบกลับในภายหลัง');
        }
      }
      
      res.status(200).json({ success: true, message: 'Webhook processed' });
    } else {
      res.status(200).json({ success: true, message: 'Unknown webhook type' });
    }
    
  } catch (error) {
    console.error('❌ LINE webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook error' });
  }
});

// LINE Webhook endpoint สำหรับทดสอบ (GET method)
router.get('/webhook', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'LINE Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});

export default router;
