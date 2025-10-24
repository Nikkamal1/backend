# 🚀 Production Deployment Checklist

## 📋 ไฟล์ที่ต้องมีใน Git Repository

### ✅ **Core Files**
- `server.js` - Main server file
- `package.json` - Dependencies and scripts
- `package-lock.json` - Lock file for dependencies
- `db.js` - Database connection
- `auth.js` - Authentication logic
- `appointments.js` - Appointment management
- `profile.js` - Profile management
- `mailer.js` - Email functionality
- `locations.js` - Location data

### ✅ **LINE Integration**
- `services/lineService.js` - LINE API service
- `routes/lineRoutes.js` - LINE API routes

### ✅ **Railway Configuration**
- `railway.json` - Railway deployment config
- `Procfile` - Process file
- `nixpacks.toml` - Build configuration
- `.gitignore` - Git ignore rules

### ✅ **Documentation**
- `railway-deploy-guide.md` - Deployment guide
- `environment-setup.md` - Environment setup guide
- `production-checklist.md` - This checklist

## 🚫 ไฟล์ที่ต้องลบออก (ไม่ควรอยู่ใน Git)

### ❌ **Test Files**
- `test-*.js` - Test files
- `*-test.js` - Test files
- `setup-*.js` - Setup scripts
- `create-user.js` - User creation script

### ❌ **Development Files**
- `line-config-example.txt` - Example config
- `thai_test.pdf` - Test PDF
- `.env` - Environment variables (sensitive)
- `.env.local` - Local environment
- `.env.production` - Production environment

### ❌ **Generated Files**
- `node_modules/` - Dependencies
- `*.log` - Log files
- `logs/` - Log directory
- `temp/` - Temporary files
- `tmp/` - Temporary files

## 🔧 Console.log Management

### ✅ **Production Ready**
- Debug logs ถูก wrap ด้วย `if (process.env.NODE_ENV === 'development')`
- Error logs ยังคงอยู่ (จำเป็นสำหรับ debugging)
- Info logs ถูกจัดการแล้ว

### 📝 **Log Levels**
```javascript
// ✅ Production Safe
console.error('Error message'); // ยังคงอยู่

// ✅ Development Only
if (process.env.NODE_ENV === 'development') {
  console.log('Debug message'); // แสดงเฉพาะ development
}

// ❌ ไม่ควรมี
console.log('Always show'); // จะแสดงใน production
```

## 🌍 Environment Variables

### **Local Development**
```env
NODE_ENV=development
DB_HOST=localhost
FRONTEND_URL=http://localhost:5173
RAILWAY_PUBLIC_DOMAIN=your-backend-domain.railway.app
```

### **Production (Railway)**
```env
NODE_ENV=production
DB_HOST=containers-us-west-xxx.railway.app
FRONTEND_URL=https://your-frontend-domain.railway.app
RAILWAY_PUBLIC_DOMAIN=your-backend-domain.railway.app
```

## 🚀 Pre-Deployment Steps

### 1. **Clean Repository**
```bash
# ลบไฟล์ที่ไม่จำเป็น
rm test-*.js
rm setup-*.js
rm create-user.js
rm line-config-example.txt
rm thai_test.pdf

# ตรวจสอบ .gitignore
git status
```

### 2. **Test Local Production Mode**
```bash
# ทดสอบ production mode
NODE_ENV=production npm start
```

### 3. **Verify Environment Detection**
```bash
# ตรวจสอบว่า environment detection ทำงาน
node -e "console.log('Environment:', process.env.NODE_ENV || 'undefined')"
```

### 4. **Check Console Logs**
```bash
# ตรวจสอบว่าไม่มี console.log ที่ไม่จำเป็น
grep -r "console\.log" . --exclude-dir=node_modules
```

## 📊 Post-Deployment Verification

### 1. **Health Check**
```bash
curl https://your-backend-domain.railway.app/health
```

### 2. **API Test**
```bash
curl https://your-backend-domain.railway.app/appointments
```

### 3. **LINE Integration**
- ทดสอบ LINE Login
- ทดสอบ LINE Webhook
- ทดสอบ LINE Notifications

### 4. **Database Connection**
- ตรวจสอบการเชื่อมต่อฐานข้อมูล
- ทดสอบ CRUD operations

## 🔒 Security Checklist

- [ ] Environment variables ไม่ถูก commit
- [ ] Database credentials ปลอดภัย
- [ ] LINE credentials ปลอดภัย
- [ ] CORS configuration ถูกต้อง
- [ ] Error messages ไม่เปิดเผย sensitive data
- [ ] Console logs ไม่แสดง sensitive information

## 📈 Performance Checklist

- [ ] Database queries มี index
- [ ] API responses มี proper caching
- [ ] File uploads มี size limits
- [ ] Memory usage อยู่ในเกณฑ์ปกติ
- [ ] Response times อยู่ในเกณฑ์ที่ยอมรับได้
