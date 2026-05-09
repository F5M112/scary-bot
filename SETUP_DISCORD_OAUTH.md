# 🆕 التحديث الأخير — استرجاع نظام Discord OAuth

## ما تغيّر

- ✅ تسجيل الدخول لا يزال **username/password**
- ✅ المستخدم بعد الدخول يربط حساب Discord من لوحة التحكم
- ✅ تظهر له **قائمة سيرفراته** (التي هو OWNER أو ADMIN فيها)
- ✅ يختار أي سيرفر يريد إدارته
- ✅ يمكن إضافة عدة سيرفرات (1 لكلاسيك، 5 للبريميوم)

---

## ⚙️ خطوة إعداد إضافية: Discord OAuth2

### 1) في Discord Developer Portal

1. اذهب لتطبيق البوت: https://discord.com/developers/applications
2. اضغط **OAuth2** في القائمة الجانبية
3. **General**:
   - انسخ **Client ID** و **Client Secret** (إذا لم يكن لديك Secret اضغط Reset Secret)
   - تحت **Redirects** اضغط **Add Redirect** وأضف:
     ```
     http://localhost:5000/auth/discord/callback
     ```
   - اضغط **Save Changes**

### 2) أضف للـ `.env` الخاص بالباك إند

افتح `backend/.env` وأضف هذه الأسطر:

```env
DISCORD_CLIENT_ID=الصق_Client_ID_هنا
DISCORD_CLIENT_SECRET=الصق_Client_Secret_هنا
DISCORD_REDIRECT_URI=http://localhost:5000/auth/discord/callback
```

### 3) أعد تشغيل الباك إند

```bash
npm run dev
```

---

## 📋 سير العمل الجديد

### للمسؤول (admin):
1. سجّل دخول بـ `admin / admin702`
2. أنشئ حساب جديد: فقط **اسم مستخدم + كلمة مرور + باقة**
3. أرسل البيانات للعميل

### للمستخدم العادي:
1. يسجّل دخول بحسابه
2. في لوحة التحكم يجد **"اربط حساب ديسكورد"**
3. يضغط الزر → يفتح Discord للمصادقة → يوافق
4. تعود الصفحة وتظهر **قائمة سيرفراته** (التي هو مشرف أو مالك فيها)
5. يضغط زر **+** بجانب السيرفر لإضافته
6. يبدأ بإدارته (إنشاء لوحات تذاكر، إذاعة، إلخ)

---

## 🛠️ إذا كانت قاعدة البيانات تحتوي على بيانات قديمة

إذا واجهت أخطاء بسبب البيانات القديمة، نظّف قاعدة البيانات:

في Terminal الباك إند:
```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { await mongoose.connection.db.dropDatabase(); console.log('✅ تم مسح كل البيانات'); process.exit(0); });"
```

ثم شغّل الباك إند:
```bash
npm run dev
```

سيُنشئ حساب admin جديد تلقائياً.

---

## ⚠️ مهم

تأكد أن البوت `Scary Ticket` **مضاف للسيرفر** الذي تريد إدارته، وإلا لن يستطيع البوت إنشاء لوحات تذاكر أو الرد عليها.

لإضافة البوت لأي سيرفر:
- روح إلى **OAuth2 → URL Generator**
- اختر Scopes: `bot`
- Bot Permissions: `Administrator`
- انسخ الرابط وافتحه واختر السيرفر
