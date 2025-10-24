# 🚌 Backend - ระบบจองรถรับ-ส่งโรงพยาบาล

## 📋 เกี่ยวกับโปรเจค

ระบบจองรถรับ-ส่งโรงพยาบาล เป็นระบบที่ช่วยให้ผู้ป่วยสามารถจองรถรับ-ส่งไปโรงพยาบาลได้อย่างสะดวก โดยมีฟีเจอร์หลักดังนี้:

- 🏥 **จองรถรับ-ส่ง** - ผู้ป่วยสามารถจองรถไปโรงพยาบาล
- 👨‍⚕️ **จัดการการจอง** - เจ้าหน้าที่และแอดมินสามารถจัดการการจอง
- 📱 **LINE Integration** - รับการแจ้งเตือนผ่าน LINE
- 📊 **Dashboard** - แดชบอร์ดสำหรับดูสถิติและรายงาน
- 🔐 **ระบบ Authentication** - ล็อกอิน/สมัครสมาชิก

## 🛠️ เทคโนโลยีที่ใช้

- **Backend**: Node.js + Express.js
- **Database**: MySQL
- **Authentication**: JWT + bcrypt
- **Email**: Nodemailer
- **LINE API**: LINE Login + Messaging API
- **PDF**: jsPDF
- **Deployment**: Railway

## 🚀 การติดตั้งและรัน

### Prerequisites
- Node.js (v16+)
- MySQL
- LINE Developer Account

### 1. Clone Repository
```bash
git clone <repository-url>
cd shuttle-system-backend
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment Variables
```bash
# Copy .env.example to .env
cp .env.example .env

# แก้ไข .env ตามการตั้งค่าของคุณ
```

### 4. ตั้งค่าฐานข้อมูล
```bash
# สร้างฐานข้อมูล MySQL
# Import schema (ถ้ามี)
```

### 5. รัน Server
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 โครงสร้างไฟล์

```
server/
├── 📄 server.js              # Main server file
├── 📄 package.json           # Dependencies
├── 📄 db.js                  # Database connection
├── 📄 auth.js                # Authentication logic
├── 📄 appointments.js        # Appointment management
├── 📄 profile.js             # Profile management
├── 📄 mailer.js              # Email service
├── 📄 locations.js           # Location data
├── 📁 services/
│   └── 📄 lineService.js     # LINE API service
├── 📁 routes/
│   └── 📄 lineRoutes.js      # LINE API routes
├── 📁 docs/
│   ├── 📄 railway-deploy-guide.md
│   ├── 📄 environment-setup.md
│   └── 📄 production-checklist.md
└── 📄 railway.json           # Railway deployment config
```

## 🔧 Environment Variables

### Local Development
```env
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

### Production (Railway)
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

## 📱 LINE Integration

### 1. สร้าง LINE Channels
- LINE Login Channel
- LINE Messaging API Channel

### 2. ตั้งค่า Environment Variables
```env
LINE_LOGIN_CHANNEL_ID=your_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_channel_secret
LINE_MESSAGING_CHANNEL_ID=your_messaging_channel_id
LINE_MESSAGING_CHANNEL_SECRET=your_messaging_channel_secret
LINE_MESSAGING_ACCESS_TOKEN=your_access_token
```

### 3. ตั้งค่า Callback URLs
- **Local**: `http://localhost:3001/api/line/login-callback`
- **Production**: `https://your-backend-domain.railway.app/api/line/login-callback`

## 🚀 Deployment

### Railway Deployment
1. Push code ไป GitHub
2. Connect GitHub repo กับ Railway
3. ตั้งค่า Environment Variables
4. Deploy

ดูรายละเอียดเพิ่มเติมใน [railway-deploy-guide.md](./railway-deploy-guide.md)

## 📊 API Endpoints

### Authentication
- `POST /login` - ล็อกอิน
- `POST /register` - สมัครสมาชิก
- `POST /verify-otp` - ตรวจสอบ OTP

### Appointments
- `GET /appointments` - ดึงรายการการจอง
- `POST /appointments/user/:userId` - สร้างการจอง (ผู้ใช้)
- `POST /appointments/staff` - สร้างการจอง (เจ้าหน้าที่)
- `PUT /appointments/:id` - อัปเดตการจอง
- `DELETE /appointments/:id` - ลบการจอง

### LINE Integration
- `GET /api/line/login-url/:userId` - สร้าง LINE Login URL
- `POST /api/line/callback` - จัดการ LINE Login callback
- `GET /api/line/status/:userId` - ตรวจสอบสถานะ LINE
- `POST /api/line/disconnect/:userId` - ยกเลิกการเชื่อมต่อ LINE

## 🔍 Health Check
- `GET /health` - ตรวจสอบสถานะ server

## 📝 License

ISC License

## 👥 Contributors

- [Your Name] - Initial work

## 📞 Support

หากมีปัญหาหรือคำถาม กรุณาติดต่อ [your-email@example.com]
