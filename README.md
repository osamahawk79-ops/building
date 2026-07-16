# 🎓 منصة التعليم الإلكتروني — Building Makers LMS

منصة تعليمية متكاملة تعمل **محلياً وبدون إنترنت** مع دعم Electron لتوليد ملف `.exe` مستقل.

---

## 🚀 تشغيل سريع

### 1. تثبيت الاعتمادية
```bash
npm install
```

### 2. تشغيل وضع التطوير (Frontend + Backend معاً)
```bash
npm run dev
# أو لتشغيل Backend فقط:
npm run server
```

> المنصة ستكون متاحة على: **http://localhost:3000**

### 3. اختبار الصحة
```bash
curl http://localhost:3000/api/health
# → {"status":"ok","server":"running"}
```

---

## 📦 بناء نسخة الإنتاج

```bash
npm run build
```

سيتم إنشاء:
- `dist/index.html` — واجهة المستخدم الأمامية
- `dist/server.cjs` — سيرفر Express المجمّع
- `dist/electron/main.cjs` — ملف Electron الرئيسي
- `dist/electron/preload.cjs` — preload script

### تشغيل نسخة الإنتاج
```bash
npm run start
```

---

## 💻 بناء تطبيق سطح المكتب (EXE)

```bash
# بناء ملف EXE كامل مع مُثبّت NSIS
npm run electron:build

# بناء بدون مُثبّت (مجلد فقط)
npm run electron:pack
```

الملف الناتج: `dist/electron-build/LMS-Platform-Setup-2.0.0-rc1.exe`

---

## 📁 هيكل المشروع

```
منصة-التعليم-الإلكتروني/
├── src/                    # كود الواجهة الأمامية (React + TypeScript)
│   ├── App.tsx             # المكوّن الرئيسي
│   ├── apiService.ts       # خدمة الاتصال بـ API
│   ├── types.ts            # أنواع TypeScript
│   └── components/
│       ├── VideoPlayer.tsx      # مشغل الفيديو الآمن
│       └── LocalFileBrowser.tsx # مستكشف الملفات المحلي
├── server/                 # كود الخادم الخلفي (Express + TypeScript)
│   ├── index.ts            # نقطة الدخول
│   ├── app.ts              # تطبيق Express الرئيسي (2250 سطر)
│   ├── config/             # إعدادات CORS, Helmet, Vite, Env
│   ├── middleware/         # Rate Limiter, Error Handler
│   └── services/           # خدمة النسخ الاحتياطي
├── electron/               # كود Electron للتطبيق المستقل
│   ├── main.ts             # العملية الرئيسية
│   └── preload.ts          # preload script
├── data/
│   └── db.json             # قاعدة البيانات المحلية (JSON)
├── storage/                # تخزين ملفات الوسائط
│   ├── videos/             # ملفات الفيديو المرفوعة
│   ├── thumbnails/         # الصور المصغرة
│   ├── attachments/        # الملفات المرفقة
│   └── branding/           # شعارات وصور العلامة التجارية
├── .env                    # متغيرات البيئة المحلية
├── package.json            # تبعيات المشروع والأوامر
├── vite.config.ts          # إعدادات Vite
└── tsconfig.json           # إعدادات TypeScript
```

---

## 🔐 نظام التوثيق والأمان

### مسارات API المتاحة

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/api/health` | GET | فحص صحة السيرفر |
| `/api/auth/register` | POST | تسجيل مستخدم جديد |
| `/api/auth/login` | POST | تسجيل الدخول بالبريد |
| `/api/auth/google` | POST | تسجيل الدخول بـ Google |
| `/api/auth/profile` | GET/PUT | بيانات المستخدم |
| `/api/categories` | GET/POST | التصنيفات |
| `/api/lectures` | GET/POST | المحاضرات |
| `/api/video/stream` | GET | بث الفيديو بتوكن آمن |
| `/api/lectures/:id/stream-token` | POST | الحصول على توكن البث |
| `/api/system/drives` | GET | قائمة الأقراص |
| `/api/system/ls` | GET | تصفح المجلدات |
| `/api/system/upload` | POST | رفع الملفات |
| `/api/admin/users` | GET | إدارة المستخدمين |
| `/api/admin/backup/create` | POST | إنشاء نسخة احتياطية |

### مسارات الفيديو الآمنة
```
1. POST /api/lectures/:id/stream-token  ← احصل على توكن (صالح ساعتين)
2. GET /api/video/stream?id=...&token=... ← شاهد الفيديو بالتوكن
```

---

## 🎬 دعم الفيديو

### مقدمي الفيديو المدعومين:
| النوع | الوصف |
|-------|-------|
| `youtube` | روابط يوتيوب (iframe embed) |
| `vimeo` | روابط Vimeo |
| `bunny` | BunnyCDN (mediadelivery.net) |
| `raw` | رابط مباشر لفيديو |
| `local` | ملف محلي مشفّر بتوكن |

### أنواع الملفات المدعومة:
- **الفيديو:** MP4, MKV, AVI, MOV, WebM
- **الصور:** PNG, JPG, GIF, WebP
- **الملفات:** PDF, ZIP, RAR, DOC, DOCX, XLS, XLSX, PPT, PPTX

---

## 🎛️ إدارة مجلدات الوسائط

المنصة تدعم ملفات الفيديو من أي مسار على الجهاز:
- `D:\LMS-Media\video.mp4`
- `C:\Users\...\Documents\lectures\`
- `storage/videos/` (داخل المشروع)

يمكن تعيين مجلدات الوسائط المعتمدة من لوحة التحكم.

---

## ⚙️ المتغيرات البيئية

| المتغير | القيمة الافتراضية | الوصف |
|---------|------------------|-------|
| `PORT` | `3000` | منفذ السيرفر |
| `NODE_ENV` | `development` | بيئة التشغيل |
| `JWT_SECRET` | `building-makers-...` | مفتاح التشفير |
| `VITE_API_URL` | `http://localhost:3000` | عنوان API |

---

## 🏗️ نظام الاشتراكات

| المستوى | الوصول | المدة |
|---------|--------|------|
| `free` | المحتوى المجاني | دائم |
| `bronze` | المحتوى البرونزي + المجاني | 15 يوم |
| `gold` | كامل المحتوى + تحميل غير محدود | 31 يوم |

---

## 🔧 استكشاف الأخطاء

### السيرفر لا يبدأ:
```bash
# تحقق من المنفذ
netstat -ano | findstr :3000
# تحقق من التبعيات
npm install
```

### خطأ "Failed to fetch":
1. تأكد أن السيرفر يعمل: `npm run server`
2. تأكد من المنفذ: `http://localhost:3000`
3. فحص الصحة: `curl http://localhost:3000/api/health`

### الفيديو لا يشتغل:
1. تأكد من صحة مسار الملف في لوحة التحكم
2. تأكد من صلاحيات القراءة على المجلد
3. تحقق من نوع الملف (MP4/H264 مُوصى به)

---

## 📝 الترخيص

هذا المشروع مُرخّص للاستخدام التجاري والشخصي لمنصة Building Makers.
