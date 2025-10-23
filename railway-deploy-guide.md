# 🚀 Railway Deployment Guide

## 🎯 รองรับทั้ง Local Development และ Production

ระบบนี้ได้รับการออกแบบให้ทำงานได้ทั้ง:
- **Local Development** (ใช้ ngrok สำหรับ LINE)
- **Production** (ใช้ Railway domain)

## 📋 ไฟล์ที่ต้องแก้ไขสำหรับ Railway

### 1. **Environment Variables ที่ต้องตั้งค่าใน Railway**

```env
# Database Configuration (Railway MySQL)
DB_HOST=containers-us-west-xxx.railway.app
DB_USER=root
DB_PASSWORD=your_railway_mysql_password
DB_NAME=railway
DB_PORT=3306

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server Configuration
PORT=3001
NODE_ENV=production

# LINE Configuration
LINE_LOGIN_CHANNEL_ID=your_line_login_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_line_login_channel_secret
LINE_MESSAGING_CHANNEL_ID=your_line_messaging_channel_id
LINE_MESSAGING_CHANNEL_SECRET=your_line_messaging_channel_secret
LINE_MESSAGING_ACCESS_TOKEN=your_line_messaging_access_token

# Frontend URL (Railway domain)
FRONTEND_URL=https://your-frontend-domain.railway.app

# ngrok URL for LINE Webhook/Callback (Railway domain)
NGROK_URL=https://your-backend-domain.railway.app
```

### 2. **การทำงานในแต่ละ Environment**

#### **Local Development**
```bash
# ใช้ ngrok สำหรับ LINE integration
npm run dev:local
# หรือ
NODE_ENV=development npm start
```

#### **Production (Railway)**
```bash
# Railway จะใช้ NODE_ENV=production อัตโนมัติ
npm start
```

### 3. **ขั้นตอนการ Deploy**

#### A. **เตรียม Database**
1. สร้าง MySQL Database ใน Railway
2. Copy connection details ไปใส่ใน Environment Variables
3. Import database schema (ถ้ามี)

#### B. **Deploy Backend**
1. Push code ไป GitHub
2. Connect GitHub repo กับ Railway
3. ตั้งค่า Environment Variables
4. Deploy

#### C. **อัปเดต LINE Configuration**
1. เปลี่ยน Callback URL ใน LINE Developers Console:
   - จาก: `https://83b3aa05f505.ngrok-free.app/api/line/login-callback`
   - เป็น: `https://your-backend-domain.railway.app/api/line/login-callback`

2. เปลี่ยน Webhook URL ใน LINE Developers Console:
   - จาก: `https://83b3aa05f505.ngrok-free.app/api/line/webhook`
   - เป็น: `https://your-backend-domain.railway.app/api/line/webhook`

#### D. **อัปเดต Frontend**
1. เปลี่ยน `VITE_API_URL` ใน Frontend:
   - จาก: `http://localhost:3001`
   - เป็น: `https://your-backend-domain.railway.app`

### 3. **ไฟล์ที่สร้างใหม่**

- ✅ `railway.json` - Railway configuration
- ✅ `Procfile` - Process file for Railway
- ✅ `Dockerfile` - Alternative deployment option
- ✅ `railway-deploy-guide.md` - This guide

### 4. **ไฟล์ที่แก้ไข**

- ✅ `package.json` - เพิ่ม start script
- ✅ `server.js` - รองรับ Railway environment
- ✅ CORS configuration - รองรับ Railway domains

### 5. **การทดสอบหลัง Deploy**

1. **Health Check**: `GET https://your-backend-domain.railway.app/health`
2. **API Test**: `GET https://your-backend-domain.railway.app/appointments`
3. **LINE Integration**: ทดสอบเชื่อมต่อ LINE
4. **Database**: ตรวจสอบการเชื่อมต่อฐานข้อมูล

### 6. **Troubleshooting**

#### Database Connection Issues
```bash
# ตรวจสอบ connection string
echo $DATABASE_URL
```

#### CORS Issues
- ตรวจสอบ `FRONTEND_URL` ใน Environment Variables
- ตรวจสอบ `allowedOrigins` ใน server.js

#### LINE Webhook Issues
- ตรวจสอบ `NGROK_URL` ใน Environment Variables
- ตรวจสอบ Webhook URL ใน LINE Developers Console

### 7. **Production Checklist**

- [ ] Environment Variables ครบถ้วน
- [ ] Database connection ทำงาน
- [ ] CORS configuration ถูกต้อง
- [ ] LINE integration ทำงาน
- [ ] Health check endpoint ทำงาน
- [ ] SSL certificate ถูกต้อง
- [ ] Error logging ทำงาน
