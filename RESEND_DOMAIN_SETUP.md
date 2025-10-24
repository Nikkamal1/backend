# 📧 Resend Domain Verification Setup

## 🎯 Overview
เพื่อให้ส่งอีเมลไปยัง recipient ใดก็ได้ (ไม่จำกัดเฉพาะอีเมลที่สมัครกับ Resend) ต้อง verify domain ใน Resend

## 🔧 Setup Steps

### 1. Add Domain to Resend
```javascript
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx');

// Add your domain
const domain = await resend.domains.create({ 
  name: 'yourdomain.com' 
});

console.log('Domain ID:', domain.data.id);
```

### 2. Get Domain ID
```javascript
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx');

// Get domain info
const domain = await resend.domains.get('domain-id-here');
console.log('Domain:', domain.data);
```

### 3. Verify Domain
```javascript
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx');

// Verify domain
const verification = await resend.domains.verify('domain-id-here');
console.log('Verification:', verification.data);
```

## 🌐 DNS Records Required

### For Domain Verification:
1. **TXT Record**: `resend._domainkey.yourdomain.com`
2. **CNAME Record**: `resend.yourdomain.com` → `resend.com`

### Example DNS Records:
```
Type: TXT
Name: resend._domainkey
Value: [Resend will provide this value]

Type: CNAME  
Name: resend
Value: resend.com
```

## 🔑 Environment Variables

### Railway Environment Variables:
```bash
# Required
RESEND_API_KEY=re_xxxxxxxxx

# Optional (for custom domain)
RESEND_DOMAIN=yourdomain.com
```

### Local .env:
```bash
RESEND_API_KEY=re_xxxxxxxxx
RESEND_DOMAIN=yourdomain.com
```

## 📧 Email Configuration

### With Custom Domain:
```javascript
const fromAddress = `"ระบบจองรถรับ-ส่งโรงพยาบาล" <noreply@${process.env.RESEND_DOMAIN}>`;
```

### Without Custom Domain (Fallback):
```javascript
const fromAddress = "onboarding@resend.dev";
```

## 🚀 Testing

### Test Domain Verification:
```bash
curl -X GET "https://api.resend.com/domains" \
  -H "Authorization: Bearer re_xxxxxxxxx"
```

### Test Email Sending:
```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer re_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": ["test@example.com"],
    "subject": "Test Email",
    "html": "<p>Test email from verified domain</p>"
  }'
```

## 🔍 Troubleshooting

### Common Issues:

1. **Domain Not Verified**
   - Check DNS records are correct
   - Wait 24-48 hours for DNS propagation
   - Verify domain status in Resend dashboard

2. **403 Forbidden**
   - Domain not verified
   - Using wrong from address
   - API key permissions

3. **DNS Issues**
   - Check TXT record format
   - Verify CNAME record
   - Use DNS checker tools

## 📊 Health Check

### Check Email Service Status:
```bash
curl https://your-backend-url/health/email
```

### Expected Response:
```json
{
  "success": true,
  "status": "configured",
  "message": "Resend is configured",
  "apiKey": "present",
  "domain": "yourdomain.com"
}
```

## 🎯 Next Steps

1. **Add Domain**: Use Resend API to add your domain
2. **Configure DNS**: Add required DNS records
3. **Verify Domain**: Use Resend API to verify
4. **Set Environment**: Add `RESEND_DOMAIN` to Railway
5. **Test**: Send test emails to various recipients

## 📚 Resources

- [Resend Domains API](https://resend.com/docs/api-reference/domains)
- [Resend DNS Setup](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Email API](https://resend.com/docs/api-reference/emails)
