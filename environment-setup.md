# 🔧 Environment Setup Guide

## 🎯 รองรับทั้ง Local และ Production

### **Local Development**

#### 1. **ตั้งค่า Environment Variables**
```bash
# Copy .env file
cp .env.example .env

# แก้ไข .env สำหรับ Local Development
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=railway
DB_PORT=3306
PORT=3001
FRONTEND_URL=http://localhost:5173
RAILWAY_PUBLIC_DOMAIN=your-backend-domain.railway.app
```

#### 2. **เริ่มต้น Server**
```bash
# เปิด terminal ใหม่
npm run dev

# Server จะรันที่ http://localhost:3001
```

#### 3. **เริ่มต้น Server**
```bash
# Local Development
npm run dev:local

# หรือ
NODE_ENV=development npm start
```

### **Production (Railway)**

#### 1. **ตั้งค่า Environment Variables ใน Railway**
```env
NODE_ENV=production
DB_HOST=containers-us-west-xxx.railway.app
DB_USER=root
DB_PASSWORD=your_railway_mysql_password
DB_NAME=railway
DB_PORT=3306
PORT=3001
FRONTEND_URL=https://your-frontend-domain.railway.app
RAILWAY_PUBLIC_DOMAIN=your-backend-domain.railway.app
```

#### 2. **Deploy to Railway**
```bash
# Railway จะใช้ NODE_ENV=production อัตโนมัติ
npm start
```

## 🔄 การสลับระหว่าง Environment

### **Local → Production**
1. เปลี่ยน `NODE_ENV=production`
2. เปลี่ยน `DB_HOST` เป็น Railway MySQL
3. เปลี่ยน `FRONTEND_URL` เป็น Railway domain
4. เปลี่ยน `RAILWAY_PUBLIC_DOMAIN` เป็น Railway domain
5. อัปเดต LINE Developers Console

### **Production → Local**
1. เปลี่ยน `NODE_ENV=development`
2. เปลี่ยน `DB_HOST` เป็น localhost
3. เปลี่ยน `FRONTEND_URL` เป็น localhost
4. เปลี่ยน `RAILWAY_PUBLIC_DOMAIN` เป็น localhost
5. อัปเดต LINE Developers Console

## 🚨 LINE Configuration

### **Local Development**
- **Callback URL**: `http://localhost:3001/api/line/login-callback`
- **Webhook URL**: `http://localhost:3001/api/line/webhook`

### **Production**
- **Callback URL**: `https://your-backend-domain.railway.app/api/line/login-callback`
- **Webhook URL**: `https://your-backend-domain.railway.app/api/line/webhook`

## 🔍 Environment Detection

ระบบจะตรวจสอบ environment อัตโนมัติ:

```javascript
// ใน server.js
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = process.env.RAILWAY_PUBLIC_DOMAIN;

// ใน lineService.js
if (this.isProduction || this.isRailway) {
  // ใช้ Railway domain
  this.baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
} else {
  // ใช้ localhost
  this.baseUrl = 'http://localhost:3001';
}
```

## 📋 Checklist

### **Local Development**
- [ ] `.env` file ถูกต้อง
- [ ] Server ทำงาน
- [ ] Database เชื่อมต่อได้
- [ ] LINE configuration ถูกต้อง
- [ ] Frontend เชื่อมต่อ Backend ได้

### **Production**
- [ ] Railway Environment Variables ครบถ้วน
- [ ] Database เชื่อมต่อได้
- [ ] LINE configuration อัปเดตแล้ว
- [ ] Frontend อัปเดต API URL แล้ว
- [ ] SSL certificate ทำงาน
