# دليل نشر منصة التعليم الإلكتروني على خوادم ومواقع الاستضافة (Web Deployment Guide)

يركز هذا الدليل على طريقة نشر منصة التعليم الإلكتروني وتشغيلها على شبكة الإنترنت لتكون متاحة للطلاب والمستخدمين في أي وقت.

تم تزويد المنصة بأداة تجميع تلقائية تُنتج ملفاً مضغوطاً جاهزاً للرفع المباشر باسم `deployment.zip` يحتوي فقط على ملفات الإنتاج الضرورية وإعدادات التشغيل لضمان الخفة والحماية.

---

## 🛠️ الخطوة 0: إنشاء ملف النشر المضغوط (`deployment.zip`)

قبل البدء بالرفع على أي استضافة، افتح سطر الأوامر (Terminal) في مجلد المشروع الرئيسي على جهازك ونفذ الأمر التالي:

```bash
npm run pack:deploy
```

**ماذا يفعل هذا الأمر؟**
1. يقوم ببناء وتجميع كود الفرونت إند والباك إند داخل مجلد `dist/`.
2. يُنشئ مجلدات البيانات `data/` ومجلدات الوسائط `storage/` المهيأة.
3. يقوم بضغط هذه الملفات فقط مع ملفات تشغيل السيرفر الأساسية، وينتج ملفاً باسم `deployment.zip` في المجلد الرئيسي للمشروع.

---

## 🌐 الخيار الأول: النشر على الاستضافات المشتركة (Shared Hosting / cPanel)
*مثل: Hostinger, Namecheap, GoDaddy, Bluehost وغيرها التي تدعم Node.js.*

### 1. رفع الملفات وفك الضغط
1. سجّل الدخول إلى لوحة التحكم **cPanel**.
2. افتح **مدير الملفات (File Manager)** وانتقل إلى المجلد الرئيسي للموقع (خارج `public_html` لضمان الأمان، مثل إنشاء مجلد باسم `lms-app`).
3. ارفع ملف `deployment.zip` الذي قمت بإنشائه محلياً، ثم قم بفك ضغطه (Extract).

### 2. إعداد تطبيق Node.js في cPanel
1. ابحث في لوحة التحكم عن أداة **Setup Node.js App** وافتحها.
2. اضغط على **Create Application**.
3. قم بضبط الحقول كالتالي:
   - **Node.js version**: اختر إصدار حديث ومستقر (يفضل إصدار **20.x** أو **22.x**).
   - **Application Mode**: اختر **Production**.
   - **Application Root**: اكتب المسار النسبي للمجلد الذي فككت الضغط فيه (مثال: `lms-app`).
   - **Application URL**: اختر النطاق أو النطاق الفرعي الذي تريد تشغيل المنصة عليه (مثال: `https://lms.yourdomain.com`).
   - **Application Startup File**: اكتب اسم ملف المدخل وهو: `app.js`.
4. اضغط على **Create**.

### 3. تثبيت الحزم وضبط البيئة (.env)
1. بعد إنشاء التطبيق، ستظهر لك صفحة التحكم به. انزل لأسفل واضغط على **Run npm install** ليقوم السيرفر بتثبيت الحزم المطلوبة للإنتاج تلقائياً.
2. في قسم **Environment variables** (متغيرات البيئة)، قم بإضافة المتغيرات التالية:
   - `NODE_ENV` بقيمة `production`
   - `PORT` بقيمة `3000` (أو المنفذ المعتمد للاستضافة)
   - `JWT_SECRET` بقيمة نص عشوائي قوي جداً لتشفير جلسات الطلاب (مثال: `MyLMS_SuperSecret_Key_2026`)
   - `GEMINI_API_KEY` بقيمة مفتاح الذكاء الاصطناعي الخاص بك من Google AI Studio (اختياري).
3. اضغط على **Save** ثم **Restart the Application** في أعلى الصفحة لتطبيق التغييرات.

---

## 💻 الخيار الثاني: النشر على السيرفرات الخاصة (VPS Deployment)
*مثل: DigitalOcean, Linode, Hetzner, AWS EC2 ويعمل بنظام Linux (Ubuntu/Debian).*

### 1. إعداد السيرفر الأساسي
قم بالاتصال بالسيرفر عبر SSH ونفذ الأوامر التالية لتثبيت Node.js و PM2:

```bash
# تحديث السيرفر
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js إصدار 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت مدير العمليات PM2 عالمياً
sudo npm install -g pm2
```

### 2. رفع وتشغيل المنصة
1. ارفع ملف `deployment.zip` إلى السيرفر الخاص بك باستخدام SFTP أو عبر أمر `scp`.
2. قم بفك الضغط في المجلد المطلوب (مثال: `/var/www/lms`):
   ```bash
   sudo apt install unzip -y
   unzip deployment.zip -d /var/www/lms
   cd /var/www/lms
   ```
3. تثبيت الاعتمادات للإنتاج فقط:
   ```bash
   npm install --omit=dev
   ```
4. انسخ ملف متغيرات البيئة وضبط إعداداته:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *(قم بضبط `PORT=3000` و `NODE_ENV=production` وكتابة `JWT_SECRET` و مفتاح `GEMINI_API_KEY` ثم احفظ الملف).*

5. تشغيل المنصة في الخلفية لتعمل بشكل دائم عبر PM2:
   ```bash
   pm2 start ecosystem.config.cjs --env production
   ```
6. لضمان تشغيل التطبيق تلقائياً عند إعادة تشغيل السيرفر:
   ```bash
   pm2 startup
   pm2 save
   ```

### 3. إعداد خادم Nginx وشهادة الأمان SSL
لتوجيه النطاق الخاص بك وتفعيل تشفير HTTPS:
1. تثبيت Nginx:
   ```bash
   sudo apt install nginx -y
   ```
2. إنشاء ملف إعدادات جديد للموقع:
   ```bash
   sudo nano /etc/nginx/sites-available/lms
   ```
3. أضف الكود التالي بداخل الملف (مع استبدال `yourdomain.com` بنطاقك):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
4. تفعيل الإعدادات وإعادة تشغيل Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```
5. تثبيت شهادة SSL مجانية من Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

## ☁️ الخيار الثالث: النشر السحابي (Cloud Platforms - Render / Railway)
*هذا الخيار يناسب المطورين الذين يفضلون ربط مستودع GitHub مباشرة مع منصة استضافة سحابية.*

### ⚠️ ملاحظة حرجة جداً (Persistent Storage)
تعتمد المنصة على ملفات محلية لحفظ قاعدة البيانات (`data/db.json`) والوسائط المرفوعة كالفيديوهات والمرفقات (`storage/`). إذا قمت بنشر التطبيق بدون قرص ثابت (Persistent Volume)، **فستفقد كافة التغييرات وحسابات الطلاب والملفات المرفوعة بمجرد إعادة تشغيل الحاوية أو عند عمل تحديث جديد (Redeploy).**

### 1. خطوات النشر على Render
1. قم برفع كود المشروع إلى مستودع خاص بك على **GitHub** (تأكد من عدم رفع ملف `.env` الفعلي أو مجلد `node_modules`).
2. قم بزيارة موقع **Render.com** وسجل الدخول.
3. اضغط على **New +** ثم اختر **Web Service**.
4. اربط حساب GitHub الخاص بك واختر مستودع المنصة.
5. اضبط الإعدادات الأساسية:
   - **Name**: اسم الخدمة (مثلاً `lms-platform`).
   - **Environment**: اختر **Docker** (سيقوم Render باستخدام ملف `Dockerfile` المرفق تلقائياً لبناء وتشغيل المنصة).
6. انزل لأسفل وافتح قسم **Advanced**:
   - اضغط على **Add Environment Variable** وضبط المتغيرات التالية:
     - `NODE_ENV` = `production`
     - `PORT` = `3000`
     - `JWT_SECRET` = (نص سري عشوائي طويل)
     - `GEMINI_API_KEY` = (مفتاح الـ API الخاص بك)
7. في قسم **Disk** (أسفل الخيارات المتقدمة):
   - اضغط على **Add Disk**.
   - **Name**: `lms-data`
   - **Mount Path**: `/app/data`
   - **Size**: اختر الحجم المناسب (مثال: `1GiB` أو أكثر حسب عدد الطلاب).
8. أضف قرص آخر للوسائط والمرفقات:
   - **Name**: `lms-storage`
   - **Mount Path**: `/app/storage`
   - **Size**: اختر حجم أكبر يتناسب مع الفيديوهات والمرفقات المرفوعة (مثال: `10GiB` أو أكثر).
9. اضغط على **Create Web Service**. سيقوم الموقع ببناء التطبيق وتشغيله وتوفير رابط HTTPS مجاني ومؤمن تلقائياً.

---

## 🛡️ إعدادات الحماية والتأمين الإضافية
- **تحديث كلمات المرور الافتراضية**: عند تشغيل الموقع لأول مرة، يرجى الدخول فوراً لحساب الإدارة الافتراضي وتعديل كلمة المرور والبريد الإلكتروني.
- **النسخ الاحتياطي الدوري**: تشتمل المنصة على نظام نسخ احتياطي مدمج للمدير بداخل لوحة التحكم، ننصح بتحميل ملفات النسخ الاحتياطي وحفظها دورياً على جهازك الشخصي للسلامة.
