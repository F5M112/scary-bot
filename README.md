# 🎫 ST Tickets — منصة التذاكر

منصة عربية متكاملة لإدارة تذاكر سيرفرات ديسكورد مع نظام إذاعة ودعم البوت المخصص.

---

## 🆕 التحديثات في هذه النسخة

### 1️⃣ نظام تسجيل دخول جديد
- ❌ تم إزالة Discord OAuth
- ✅ تسجيل دخول باسم مستخدم وكلمة مرور
- ✅ كلمات المرور مشفرة بـ bcrypt
- ✅ حساب الإدارة الافتراضي يُنشأ تلقائياً

### 2️⃣ إنشاء حسابات من الإدارة
- ✅ المسؤول ينشئ حسابات للعملاء
- ✅ كل حساب مرتبط بمعرف سيرفر ديسكورد
- ✅ توليد كلمات مرور عشوائية تلقائياً
- ✅ إعادة تعيين كلمة المرور
- ✅ نسخ بيانات الدخول لإرسالها للعميل

### 3️⃣ نظام لوحات تذاكر متقدم
- ✅ معاينة مباشرة لشكل اللوحة في ديسكورد
- ✅ Embed كامل (عنوان، وصف، صور، ألوان، تذييل)
- ✅ أزرار متعددة بـ 4 ألوان
- ✅ قوائم منسدلة مع وصف وإيموجي
- ✅ اختيار قنوات وأدوار من قوائم منسدلة

### 4️⃣ تصميم جديد
- 🎨 لوحة ألوان حمراء احترافية
- 🌟 لوقو ST مدمج
- 🌐 دعم العربية والإنجليزية مع زر تبديل

---

## 🔐 بيانات حساب الإدارة الافتراضي

```
اسم المستخدم: admin
كلمة المرور: admin702
```

⚠️ **مهم:** غيّر كلمة المرور بعد أول تسجيل دخول من إعدادات الحساب.

---

## 🚀 خطوات التشغيل

### 1) إعداد ملف `backend/.env`

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/discord-saas
JWT_SECRET=long_random_string_change_me
JWT_EXPIRES_IN=7d

# توكن البوت من Discord Developer Portal
PLATFORM_BOT_TOKEN=your_bot_token

# مفتاح تشفير (32 حرف بالضبط)
ENCRYPTION_KEY=12345678901234567890123456789012

FRONTEND_URL=http://localhost:3000
```

### 2) إعداد ملف `frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3) تشغيل الباك إند

```bash
cd backend
npm install
npm run dev
```

ستظهر الرسائل:
```
✅ تم الاتصال بقاعدة البيانات
✅ تم إنشاء حساب الإدارة الافتراضي (admin / admin702)
✅ البوت الرئيسي جاهز
🚀 السيرفر يعمل على المنفذ 5000
```

### 4) تشغيل الفرونت إند

```bash
cd frontend
npm install
npm run dev
```

افتح: http://localhost:3000

---

## 📋 سير العمل (Workflow)

### كمسؤول (Admin):
1. سجّل دخول بـ `admin / admin702`
2. ستذهب تلقائياً لـ `/admin`
3. اضغط **"إنشاء حساب جديد"**
4. املأ:
   - اسم المستخدم
   - كلمة المرور (أو ولّد عشوائية)
   - معرف السيرفر (Discord Server ID)
   - الباقة (none / classic / premium)
5. اضغط **إنشاء**
6. **انسخ بيانات الدخول** وأرسلها للعميل

### كعميل (User):
1. استلم بيانات الدخول من الإدارة
2. ادخل على الموقع وسجّل دخول
3. ستجد سيرفرك مرتبط تلقائياً
4. ابدأ بإنشاء لوحات تذاكر متقدمة

---

## 🗄️ قاعدة البيانات

### Users (جديد)
```js
{
  username: 'user_server1',
  password: 'hashed_with_bcrypt',
  displayName: 'مالك سيرفر الألعاب',
  role: 'admin' | 'user',
  guildId: '123456789012345678',     // معرف السيرفر المربوط
  plan: 'none' | 'classic' | 'premium',
  planExpiresAt: Date,
  isBanned: false,
  isDisabled: false,
}
```

### Guilds
```js
{
  guildId: '123...',
  ownerId: ObjectId,                  // مرجع لـ User._id
  enabled: true,
  ticketPanels: [...],
}
```

---

## 🔗 API الجديد

### Auth
- `POST /auth/login` — تسجيل دخول بـ username/password
- `GET  /auth/me` — معلومات الحساب الحالي
- `POST /auth/change-password` — تغيير كلمة المرور
- `POST /auth/logout`

### Admin (للمسؤول فقط)
- `POST   /admin/users` — إنشاء حساب جديد
- `GET    /admin/users` — قائمة الحسابات
- `PATCH  /admin/users/:id` — تعديل حساب
- `DELETE /admin/users/:id` — حذف حساب
- `POST   /admin/users/:id/reset-password` — إعادة تعيين كلمة المرور
- `POST   /admin/users/:id/plan` — تعيين الباقة
- `POST   /admin/users/:id/ban` — حظر
- `POST   /admin/users/:id/disable` — تعطيل

---

## 🎨 المميزات الرئيسية

| المميزة | كلاسيك | بريميوم |
|---------|--------|---------|
| نظام تذاكر متكامل | ✅ | ✅ |
| لوحات تذاكر مخصصة | ✅ | ✅ |
| تصدير المحادثات | ✅ | ✅ |
| البوت الرئيسي | ✅ | ✅ |
| البوت المخصص | ❌ | ✅ |
| نظام الإذاعة | ❌ | ✅ |
| سجلات تفصيلية | ❌ | ✅ |

---

## 🛠️ تقنيات

**الباك إند:**
- Node.js + Express
- MongoDB + Mongoose
- Discord.js v14
- JWT + bcrypt
- AES-256 لتشفير توكنات البوت

**الفرونت إند:**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Zustand (state management)
- React Hot Toast

---

## 🎨 العلامة التجارية

- **اللوقو:** ST (مدمج في `/public/logo.png`)
- **اللون الأساسي:** أحمر (#dc2626)
- **النمط:** Dark mode مع توهج أحمر
"# scary-store1" 
