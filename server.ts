import express from "express";
import path from "path";
import fs from "fs";
import { execSync, exec } from "child_process";
import https from "https";
import multer from "multer";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { UserProfile, Category, Lecture, LMSConfig } from "./src/types";

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// Security & Traffic Control (Local Server Safeguards)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for local Vite dev server compatibility
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());

// --- NATIVE FILE PICKER BRIDGE ---
app.get("/api/system/native-picker", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const isVideo = req.query.type === 'video';
    let command = "";

    if (process.platform === 'win32') {
      const filter = isVideo ? "Video Files (*.mp4;*.mkv;*.avi;*.mov;*.webm)|*.mp4;*.mkv;*.avi;*.mov;*.webm" : "All Files (*.*)|*.*";
      command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = '${filter}'; $f.ShowDialog() | Out-Null; $f.FileName"`;
    } else if (process.platform === 'darwin') {
      command = `osascript -e 'POSIX path of (choose file)'`;
    } else {
      // Check if zenity is available on Linux (headless environments like Cloud Run won't have it)
      try {
        execSync('which zenity', { stdio: 'ignore' });
        command = `zenity --file-selection`;
      } catch (e) {
        return res.status(500).json({ 
          error: "بيئة السيرفر الحالية لا تدعم فتح نافذة ملفات النظام (غالباً بسبب التشغيل السحابي). يرجى استخدام متصفح الملفات المدمج.",
          isHeadless: true
        });
      }
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("[PICKER] Error:", error);
        // Fallback or return error
        return res.status(500).json({ error: "فشل فتح نافذة الملفات. تأكد من تشغيل السيرفر على نفس الجهاز." });
      }
      const selectedPath = stdout.trim();
      if (!selectedPath) {
        return res.json({ cancelled: true });
      }
      res.json({ success: true, path: selectedPath });
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطأ في السيرفر: " + err.message });
  }
});

// Rate Limiting to prevent local resource flooding
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  message: "لقد تجاوزت حد الطلبات المسموح به، يرجى المحاولة لاحقاً.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply limiter to all API routes
app.use("/api/", limiter);

// Enable JSON body parsing with large limits for embedded media/assets
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Ensure folders exist for local on-premise installation
const DATA_DIR = path.join(process.cwd(), "data");
const STORAGE_DIR = path.join(process.cwd(), "storage");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
// Ensure specific sub-folders exist
const subDirs = ["videos", "attachments", "thumbnails", "branding"];
subDirs.forEach(dir => {
  const d = path.join(STORAGE_DIR, dir);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// --- FILE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.query.type as string || 'general';
    let folder = STORAGE_DIR;
    
    if (type === 'video') folder = path.join(STORAGE_DIR, 'videos');
    else if (type === 'attachment') folder = path.join(STORAGE_DIR, 'attachments');
    else if (type === 'thumbnail') folder = path.join(STORAGE_DIR, 'thumbnails');
    else if (type === 'branding') folder = path.join(STORAGE_DIR, 'branding');
    
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // Keep original name but prepend timestamp to avoid collisions
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const systemUpload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 * 5 } // 5GB limit for large local videos
});

app.post("/api/system/upload", systemUpload.single('file'), (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

    if (!req.file) return res.status(400).json({ error: "لم يتم اختيار ملف" });

    res.json({ 
      success: true, 
      path: req.file.path,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err: any) {
    console.error("[UPLOAD] Error:", err);
    res.status(500).json({ error: "فشل رفع الملف: " + err.message });
  }
});

app.post("/api/system/verify-path", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ error: "المسار مطلوب" });

    const normalizedPath = path.normalize(targetPath);
    if (fs.existsSync(normalizedPath)) {
      const stats = fs.statSync(normalizedPath);
      return res.json({ 
        exists: true, 
        isDirectory: stats.isDirectory(),
        size: stats.size,
        name: path.basename(normalizedPath)
      });
    } else {
      return res.json({ exists: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطأ أثناء التحقق من المسار: " + err.message });
  }
});

const PLACEHOLDER_VIDEO_PATH = path.join(STORAGE_DIR, "videos", "placeholder.mp4");

function downloadPlaceholderVideo() {
  if (fs.existsSync(PLACEHOLDER_VIDEO_PATH)) {
    const size = fs.statSync(PLACEHOLDER_VIDEO_PATH).size;
    if (size > 1000) return; // already exists and is not empty
  }

  const download = (url: string) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          download(redirectUrl);
          return;
        }
      }

      if (response.statusCode !== 200) {
        console.error(`Failed to download placeholder video, status code: ${response.statusCode}`);
        return;
      }

      const file = fs.createWriteStream(PLACEHOLDER_VIDEO_PATH);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log("Placeholder video downloaded successfully!");
      });
    }).on('error', (err) => {
      console.error("Failed to download placeholder video:", err);
    });
  };

  download("https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
}

// Start download asynchronously in the background
// downloadPlaceholderVideo();

// Initial branding & platform configurations
const DEFAULT_CONFIG: LMSConfig = {
  siteName: "Building Makers",
  logoUrl: "",
  logoWidth: 160,
  logoHeight: 40,
  logoPadding: 0,
  fontFamily: 'Cairo',
  heroMediaUrl: "",
  heroMediaType: 'image',
  heroOpacity: 60,
  heroBlur: 2,
  mainTitle: "منصة دراسية متطورة 100% باللغة العربية | بوابتك الذكية لاحتراف المهارات التقنية والعملية",
  subTitle: "تعلم صيانة السيارات، الجرافيك، الإلكترونيات، والبرمجة مع نخبة من المهندسين الخبراء والمهنيين.",
  primaryColor: "#f97316",
  mediaRootFolder: path.join(process.cwd(), "storage"),
  mediaFolders: [path.join(process.cwd(), "storage")],
  paymentDetails: {
    walletNumbers: [
      { name: "رقم المدير (أورنج كاش)", number: "01226188108", provider: "أورنج كاش Orange Cash" },
      { name: "تحويلات إنستا باي InstaPay", number: "01226188108", provider: "إنستا باي InstaPay" }
    ]
  }
};

const SEED_CATEGORIES: Category[] = [
  { id: 'car-maintenance', name: 'صيانة السيارات', description: 'أساسيات صيانة السيارات، تشخيص الأعطال بالكمبيوتر، وتصليح المحركات وأنظمة الأمان الحديثة.' },
  { id: 'graphics-effects', name: 'الجرافيك والأفتر إفكت', description: 'صناعة المؤثرات البصرية، الأنيميشن الاحترافي، ومونتاج الفيديو باستخدام Photoshop و Adobe After Effects.' },
  { id: 'electronics', name: 'الإلكترونيات والدوائر', description: 'فهم العناصر الإلكترونية، قراءة المخططات الهندسية، قياس المكونات، وتصميم الدوائر المطبوعة PCB.' },
  { id: 'arduino-programming', name: 'الأردوينو والبرمجة', description: 'إنترنت الأشياء (IoT)، برمجة الميكروكنترولر، وبناء مشاريع ذكية تفاعلية باستخدام لغة C++ ومتحكمات Arduino.' }
];

const SEED_LECTURES: Lecture[] = [
  {
    id: 'lec-car-1',
    categoryId: 'car-maintenance',
    title: 'كيف تعمل شمعات الاحتراق (بوجيهات السيارة) ومتى يجب تغييرها؟',
    description: 'شرح مفصل ومبسط حول نظرية عمل شمعات الاحتراق بداخل غرف المحرك، الأعراض الشهيرة لتلفها، وطريقة فحصها بمقاييس هندسية دقيقة لتجنب هدر الوقود.',
    videoUrl: 'https://www.youtube.com/watch?v=FjIuCAn6fT0',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/car-spark-plugs-guide/spark_plugs_workbook.pdf',
    fileName: 'كتيب صيانة شمعات الاحتراق.pdf',
    tierRequired: 'free'
  },
  {
    id: 'lec-car-2',
    categoryId: 'car-maintenance',
    title: 'فحص الحساسات وتشخيص أعطال السيارات بجهاز OBD-II',
    description: 'في هذه المحاضرة المتقدمة، نتعلم سوياً كيفية قراءة الأكواد التحذيرية وحل مشكلة لمبة المحرك (Check Engine) باستخدام أجهزة OBD-II للمحترفين.',
    videoUrl: 'https://www.youtube.com/watch?v=Yf-V_kC-h5s',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/obd2-fault-codes/OBD2_Diagnostic_Codes.pdf',
    fileName: 'جدول أكواد أعطال السيارات OBD.pdf',
    tierRequired: 'bronze'
  },
  {
    id: 'lec-graphics-1',
    categoryId: 'graphics-effects',
    title: 'أساسيات الأفتر إفكت وصناعة أول مشهد أنيميشن للمبتدئين',
    description: 'فهم واجهة برنامج Adobe After Effects، شرح نافذة الكومبوزيشن والتايملاين، واستخدام الكي-فريمز لإنشاء مؤثرات بصرية مذهلة وحركة ناعمة.',
    videoUrl: 'https://www.youtube.com/watch?v=0h94hT9nK8o',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/after-effects-shortcuts/ae_shortcuts.pdf',
    fileName: 'اختصارات لوحة مفاتيح الأفتر إفكت.pdf',
    tierRequired: 'free'
  },
  {
    id: 'lec-graphics-2',
    categoryId: 'graphics-effects',
    title: 'تحريك النصوص والشعارات ثلاثية الأبعاد بأسلوب الـ Kinetic Typography',
    description: 'شرح كامل لأدوات النصوص المتقدمة ببرنامج After Effects وتوليد الظلال الواقعية وتحريك الكاميرا لصناعة الإعلانات الاحترافية والشعارات المتحركة.',
    videoUrl: 'https://www.youtube.com/watch?v=LqUa2XqB1V8',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/kinetic-typography-project/kinetic_typography.zip',
    fileName: 'ملفات المشروع والشعارات الجاهزة.zip',
    tierRequired: 'gold'
  },
  {
    id: 'lec-elec-1',
    categoryId: 'electronics',
    title: 'قانون أوم وتوصيل المقاومات على التوالي والتوازي',
    description: 'الدرس التأسيسي في علم الكهرباء والإلكترونيات، شرح مفاهيم الجهد، التيار، والمقاومة، وكيفية حساب الفولت بداخل الدوائر العملية.',
    videoUrl: 'https://www.youtube.com/watch?v=gS6oE5jU358',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/electronics-basics-ohm/ohms_law_exercises.pdf',
    fileName: 'تمارين ومسائل محلولة في قانون أوم.pdf',
    tierRequired: 'free'
  },
  {
    id: 'lec-arduino-1',
    categoryId: 'arduino-programming',
    title: 'البداية السريعة مع الأردوينو: كتابة كود بلينك للتحكم بالـ LED',
    description: 'شرح اللوحة التطويرية الأردوينو أونو، تحميل برنامج Arduino IDE، وكتابة كود برمجي بلغة C++ للتحكم في الإضاءة عبر المنافذ الرقمية.',
    videoUrl: 'https://www.youtube.com/watch?v=nL346W7Be9U',
    videoProvider: 'youtube',
    fileUrl: 'https://archive.org/download/arduino-guide-beginners/arduino_starter.pdf',
    fileName: 'دليل تجارب الأردوينو للمبتدئين.pdf',
    tierRequired: 'free'
  }
];

// Helper to read database
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [] as UserProfile[],
      categories: SEED_CATEGORIES,
      lectures: SEED_LECTURES,
      settings: DEFAULT_CONFIG
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    let updated = false;

    if (!parsed.localFiles) {
      parsed.localFiles = [];
      updated = true;
    }

    if (!parsed.settings.mediaRootFolder) {
      parsed.settings.mediaRootFolder = path.join(process.cwd(), "storage");
      updated = true;
    }

    if (!parsed.settings.mediaFolders) {
      parsed.settings.mediaFolders = [parsed.settings.mediaRootFolder || path.join(process.cwd(), "storage")];
      updated = true;
    }

    // Enforce 30 days subscription expire date checks automatically

    // Auto-update to correct orange cash & instapay if default dummy values exist
    if (parsed.settings && parsed.settings.paymentDetails && parsed.settings.paymentDetails.walletNumbers) {
      const hasOldDummy = parsed.settings.paymentDetails.walletNumbers.some(
        (w: any) => w.number === "01002345678" || w.number === "lms@instapay"
      );
      if (hasOldDummy) {
        parsed.settings = { ...parsed.settings, ...DEFAULT_CONFIG };
        updated = true;
      }
    }

    const now = Date.now();
    if (parsed.users) {
      parsed.users = parsed.users.map((u: UserProfile) => {
        if (u.subscriptionStatus === 'active' && u.subscriptionExpiresAt) {
          const expiryTime = new Date(u.subscriptionExpiresAt).getTime();
          if (expiryTime < now) {
            // Subscription expired! Suspend access
            u.subscriptionStatus = 'none'; // Will trigger Suspended/Expired warning
            u.subscription = 'none';
            updated = true;
          }
        }
        return u;
      });
    }
    if (updated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf8");
    }
    return parsed;
  } catch (err) {
    console.error("Error reading Local DB file:", err);
    return {
      users: [] as UserProfile[],
      categories: SEED_CATEGORIES,
      lectures: SEED_LECTURES,
      settings: DEFAULT_CONFIG
    };
  }
}

// Helper to write database
function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing Local DB file:", err);
  }
}

// Enable local serving of files uploaded directly onto the user's hard drive
app.use("/storage", express.static(STORAGE_DIR));

// Configure local Disk Storage using multer with dynamic path resolution
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { type, section, lectureId } = req.body;
      let targetDir = STORAGE_DIR;

      // Sanitize inputs to prevent path traversal or invalid characters
      const safeSection = (section || "uncategorized").replace(/[^a-z0-9_\u0600-\u06FF\s-]/gi, '_');
      const safeLecId = (lectureId || "temp").replace(/[^a-z0-9_\u0600-\u06FF\s-]/gi, '_');

      if (type === "video") {
        targetDir = path.join(STORAGE_DIR, "videos", safeSection, safeLecId);
      } else if (type === "attachment") {
        targetDir = path.join(STORAGE_DIR, "attachments", safeSection, safeLecId);
      } else if (type === "thumbnail") {
        targetDir = path.join(STORAGE_DIR, "thumbnails");
      } else if (type === "branding") {
        targetDir = path.join(STORAGE_DIR, "branding");
      } else if (type === "category_preview") {
        targetDir = path.join(STORAGE_DIR, "thumbnails", "previews");
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } catch (err) {
      cb(err as any, STORAGE_DIR);
    }
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `file-${uniqueId}${fileExt}`);
  },
});
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "building-makers-super-secret-key-2026";

function generateToken(uid: string): string {
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(uid).digest("hex");
  return `${uid}.${signature}`;
}

function verifyToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [uid, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(uid).digest("hex");
  if (signature === expectedSignature) {
    return uid;
  }
  return null;
}

// Secure media tokens (Token-based Signed URLs with expiration)
function generateMediaToken(uid: string, lectureId: string, type: 'stream' | 'download'): string {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // valid for 2 hours
  const payload = JSON.stringify({ uid, lectureId, type, expiresAt });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${signature}`;
}

function verifyMediaToken(token: string, requiredType: 'stream' | 'download'): { uid: string, lectureId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  if (signature !== expectedSignature) return null;
  
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const { uid, lectureId, type, expiresAt } = JSON.parse(payloadJson);
    if (type !== requiredType) return null;
    if (Date.now() > expiresAt) return null; // Expired
    return { uid, lectureId };
  } catch (err) {
    return null;
  }
}

// Server-side check for user's authorization to access a lecture
function checkLectureAccess(user: UserProfile | null, lecture: Lecture): { hasAccess: boolean; error?: string } {
  if (!user) {
    return { hasAccess: false, error: "يجب تسجيل الدخول أولاً للوصول إلى هذا المحتوى" };
  }
  
  if (user.role === "admin") {
    return { hasAccess: true };
  }
  
  if (user.subscriptionStatus === "blocked") {
    return { hasAccess: false, error: "حسابك محظور من قبل الإدارة. يرجى التواصل مع الدعم" };
  }
  
  const tierMap = {
    free: 0,
    bronze: 1,
    gold: 2
  };
  
  const requiredTier = lecture.tierRequired || "free";
  const requiredVal = tierMap[requiredTier] || 0;
  
  if (requiredVal === 0) {
    return { hasAccess: true }; // Free content accessible to logged-in users
  }
  
  if (user.subscriptionStatus !== "active") {
    return { hasAccess: false, error: "يجب تفعيل الاشتراك لمشاهدة هذا المحتوى التعليمي" };
  }
  
  if (user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt).getTime();
    if (expiresAt < Date.now()) {
      return { hasAccess: false, error: "انتهت صلاحية اشتراكك. يرجى تجديد الاشتراك للاستمرار بالمشاهدة" };
    }
  }
  
  const userTier = user.subscription || "none";
  const userVal = tierMap[userTier as 'none' | 'bronze' | 'gold'] || 0;
  
  if (userVal < requiredVal) {
    return { hasAccess: false, error: `هذا الدرس يتطلب الاشتراك في الباقة ${requiredTier === 'bronze' ? 'البرونزية' : 'الذهبية'} أو أعلى` };
  }
  
  return { hasAccess: true };
}

// Log video and files access operations
function logVideoAccess(username: string, email: string, role: string, actionType: string, lectureTitle: string, lectureId: string, filePath: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] User: ${username} (${email}), Role: ${role}, Action: ${actionType}, Lecture: "${lectureTitle}" (ID: ${lectureId}), FilePath: "${filePath}"\n`;
  try {
    const logDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFilePath = path.join(logDir, "video_access.log");
    fs.appendFileSync(logFilePath, logMessage, "utf8");
    console.log(`Video Access Logged: ${logMessage.trim()}`);
  } catch (err) {
    console.error("Failed to write to video access log file:", err);
  }
}

const upload = multer({ 
  storage: storageConfig,
  limits: { fileSize: 1024 * 1024 * 1024 * 2 }, // 2GB limit for local video uploads
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    // Whitelist allowed extensions to prevent executable code execution or stored XSS
    const allowedExtensions = [
      // Videos
      ".mp4", ".m4v", ".mov", ".avi", ".mkv", ".webm",
      // Images
      ".png", ".jpg", ".jpeg", ".gif", ".webp",
      // Attachments & Documents
      ".pdf", ".zip", ".rar", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"
    ];

    if (!allowedExtensions.includes(fileExt)) {
      return cb(new Error("نوع الملف غير مسموح برفته لأسباب أمنية."));
    }
    
    cb(null, true);
  }
});

// Middleware to resolve logged in User via secure signed Bearer Token Header
function getAuthUser(req: express.Request): UserProfile | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  
  let uid = verifyToken(token);
  if (!uid) {
    // If we are in non-production, fallback to direct uid for dev and test compatibility
    if (process.env.NODE_ENV !== "production") {
      uid = token;
    } else {
      return null;
    }
  }

  const db = readDB();
  return db.users.find((u: UserProfile) => u.uid === uid) || null;
}

// --- API ENDPOINTS ---

// API: Health Check for Local Connectivity
app.get("/api/health", (req, res) => {
  res.json({ status: "running", mode: "local_on_premise", timestamp: new Date() });
});

/**
 * Improved security helper to check if a path is safe to access.
 * Prevents access to system folders and sensitive files.
 */
function isPathSafe(filePath: string): { safe: boolean; error?: string } {
  try {
    const normalized = path.normalize(filePath).toLowerCase();
    
    // Block sensitive system folders (Windows specific)
    const blockedFolders = [
      'c:\\windows', 
      'c:\\winnt', 
      'c:\\program files', 
      'c:\\program files (x86)',
      'c:\\users\\all users',
      'c:\\recovery',
      '\\system volume information',
      '\\$recycle.bin'
    ];

    if (blockedFolders.some(f => normalized.startsWith(f))) {
      return { safe: false, error: "مجلد نظام محمي" };
    }

    // Block sensitive files in project root
    const sensitiveFiles = ['.env', 'db.json', 'server.ts', 'package.json', 'package-lock.json'];
    const fileName = path.basename(normalized);
    if (sensitiveFiles.includes(fileName)) {
      return { safe: false, error: "ملف نظام حساس" };
    }

    return { safe: true };
  } catch (e) {
    return { safe: false, error: "مسار غير صالح" };
  }
}

// Video Streaming Endpoint for optimized local delivery
app.get("/api/videos/stream", (req, res) => {
  try {
    const videoPath = req.query.path as string;
    if (!videoPath) {
      return res.status(400).send("Path is required");
    }

    // Resolve absolute path
    const fullPath = path.resolve(videoPath);
    
    // Security Check
    const safety = isPathSafe(fullPath);
    if (!safety.safe) {
      return res.status(403).send(`Access denied: ${safety.error}`);
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("File not found");
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getContentType(fullPath);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(fullPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      };
      res.writeHead(200, head);
      fs.createReadStream(fullPath).pipe(res);
    }
  } catch (error: any) {
    console.error("[STREAM] Error:", error);
    res.status(500).send("Internal server error during streaming");
  }
});

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}


// Auth Profile
app.get("/api/auth/profile", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "غير مصرح بالدخول" });
  }
  res.json({ profile: user });
});

// Quick registration
app.post("/api/auth/register", (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username) {
    return res.status(400).json({ error: "يرجى تعبئة جميع الحقول المطلوبة" });
  }

  const db = readDB();
  const existing = db.users.find((u: UserProfile) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل" });
  }

  const isFirstUser = db.users.length === 0;

  const newUser: UserProfile = {
    uid: "usr-" + Date.now() + "-" + Math.round(Math.random() * 1000),
    username,
    email: email.toLowerCase(),
    role: isFirstUser ? "admin" : "user",
    subscription: "none",
    subscriptionStatus: "none",
    pendingSubscriptionType: "none",
    paymentTxInfo: null,
    downloadCounter: 0,
    maxDownloads: 10,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  res.json({ profile: newUser, token: generateToken(newUser.uid) });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "يرجى توفير البريد الإلكتروني" });
  }

  const db = readDB();
  const user = db.users.find((u: UserProfile) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود، يرجى التسجيل أولاً" });
  }

  res.json({ profile: user, token: generateToken(user.uid) });
});

// Sign In With Google OAuth (creates user profile locally instantly)
app.post("/api/auth/google", (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: "بريد جوجل مطلوب" });
  }

  const db = readDB();
  let user = db.users.find((u: UserProfile) => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    user = {
      uid: "google-usr-" + Date.now(),
      username: name || "مستخدم Google",
      email: email.toLowerCase(),
      role: db.users.length === 0 ? "admin" : "user",
      subscription: "none",
      subscriptionStatus: "none",
      pendingSubscriptionType: "none",
      paymentTxInfo: null,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDB(db);
  }

  res.json({ profile: user, token: generateToken(user.uid) });
});

// Update Profile subscription / submission
app.put("/api/auth/profile", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "غير مصرح بالدخول" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: UserProfile) => u.uid === authUser.uid);
  if (userIndex === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  // Strict Field Filtering to prevent Privilege Escalation
  const allowedKeys = ["username", "subscriptionStatus", "pendingSubscriptionType", "paymentTxInfo"];
  const updates: any = {};
  
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) {
      if (key === "subscriptionStatus") {
        const val = req.body[key];
        // Regular users can only request "pending" activation or "none" (cancel/reset)
        if (val === "pending" || val === "none") {
          updates[key] = val;
        }
      } else if (key === "pendingSubscriptionType") {
        const val = req.body[key];
        if (val === "none" || val === "bronze" || val === "gold") {
          updates[key] = val;
        }
      } else {
        updates[key] = req.body[key];
      }
    }
  }

  db.users[userIndex] = {
    ...db.users[userIndex],
    ...updates
  };
  writeDB(db);

  res.json({ profile: db.users[userIndex] });
});

// Get Categories
app.get("/api/categories", (req, res) => {
  const db = readDB();
  res.json({ categories: db.categories });
});

// Save / Add Category
app.post("/api/categories", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const { id, name, description, imageUrl } = req.body;
  if (!name) {
    return res.status(400).json({ error: "اسم القسم مطلوب" });
  }

  const db = readDB();
  const index = db.categories.findIndex((c: Category) => c.id === id);
  const newCat: Category = {
    id: id || "cat-" + Date.now(),
    name,
    description: description || "",
    imageUrl: imageUrl || "",
    createdAt: new Date().toISOString()
  };

  if (index !== -1) {
    db.categories[index] = newCat;
  } else {
    db.categories.push(newCat);
  }
  writeDB(db);

  res.json({ category: newCat });
});

// Delete Category
app.delete("/api/categories/:id", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const db = readDB();
  db.categories = db.categories.filter((c: Category) => c.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// Get Lectures
app.get("/api/lectures", (req, res) => {
  const db = readDB();
  res.json({ lectures: db.lectures });
});

// Save / Add Lecture
app.post("/api/lectures", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const { id, categoryId, title, description, videoUrl, videoProvider, fileUrl, fileName, tierRequired, thumbnailUrl } = req.body;
  if (!title || !categoryId) {
    return res.status(400).json({ error: "بيانات الدرس غير مكتملة" });
  }

  const db = readDB();
  const index = db.lectures.findIndex((l: Lecture) => l.id === id);
  const newLec: Lecture = {
    id: id || "lec-" + Date.now(),
    categoryId,
    title,
    description: description || "",
    videoUrl: videoUrl || "",
    videoProvider: videoProvider || "youtube",
    fileUrl: fileUrl || "",
    fileName: fileName || "",
    tierRequired: tierRequired || "free",
    thumbnailUrl: thumbnailUrl || "",
    createdAt: new Date().toISOString()
  };

  if (index !== -1) {
    db.lectures[index] = {
      ...db.lectures[index],
      ...newLec,
      // Maintain original createdAt if editing
      createdAt: db.lectures[index].createdAt || newLec.createdAt
    };
  } else {
    db.lectures.push(newLec);
  }

  // --- LOCAL FILES SYNCHRONIZATION ---
  if (!db.localFiles) db.localFiles = [];

  // Remove existing local files linked to this lecture to recreate/sync them
  db.localFiles = db.localFiles.filter((lf: any) => lf.lectureId !== newLec.id);

  const checkAndAddLocalFile = (filePath: string, type: 'video' | 'pdf' | 'image' | 'attachment') => {
    if (!filePath) return;
    const isLocal = filePath.startsWith('/') || filePath.includes('\\') || filePath.includes(':');
    if (isLocal) {
      try {
        const normalized = path.normalize(filePath);
        
        // Use resolveScopedPath to automatically expand the media root if file exists outside
        // This ensures the server "adopts" the new path partition/folder automatically.
        const resolved = resolveScopedPath(normalized, true);
        
        let size = 0;
        let exists = !!resolved;
        
        if (exists && resolved) {
          const stats = fs.statSync(resolved);
          size = stats.size;
        }
        
        const fName = path.basename(normalized);
        db.localFiles.push({
          id: `lf-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          fileName: fName,
          fullPath: normalized,
          fileType: type,
          size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lectureId: newLec.id
        });
      } catch (err) {
        console.error("Error adding local file stats:", err);
      }
    }
  };

  if (newLec.videoUrl && newLec.videoProvider === 'local') {
    checkAndAddLocalFile(newLec.videoUrl, 'video');
  }
  if (newLec.fileUrl) {
    checkAndAddLocalFile(newLec.fileUrl, newLec.fileUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'attachment');
  }
  // ------------------------------------

  writeDB(db);

  res.json({ lecture: db.lectures.find((l: any) => l.id === newLec.id) });
});

// Delete Lecture
app.delete("/api/lectures/:id", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const db = readDB();
  db.lectures = db.lectures.filter((l: Lecture) => l.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// Save Auto-Generated Lecture Thumbnail from Client Canvas
app.post("/api/lectures/:id/thumbnail", (req, res) => {
  const { id } = req.params;
  const { thumbnailDataUrl } = req.body;
  if (!thumbnailDataUrl) {
    return res.status(400).json({ error: "بيانات الصورة المصغرة مطلوبة" });
  }

  try {
    const db = readDB();
    const index = db.lectures.findIndex((l: any) => l.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "المحاضرة غير موجودة" });
    }

    // Parse base64 data url
    const matches = thumbnailDataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "صيغة الصورة غير صالحة" });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const filename = `thumb-${id}-${Date.now()}.${ext}`;
    const destPath = path.join(STORAGE_DIR, "thumbnails", filename);

    // Ensure storage/thumbnails folder exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destPath, data);

    const relativeUrl = `/storage/thumbnails/${filename}`;
    db.lectures[index].thumbnailUrl = relativeUrl;
    writeDB(db);

    res.json({ success: true, thumbnailUrl: relativeUrl });
  } catch (err: any) {
    console.error("Failed to save lecture thumbnail:", err);
    res.status(500).json({ error: "فشل حفظ الصورة المصغرة: " + err.message });
  }
});

// Generate a short-lived, signed token for video streaming
app.post("/api/lectures/:id/stream-token", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "يجب تسجيل الدخول أولاً للوصول للبث" });
  }

  const db = readDB();
  const lecture = db.lectures.find((l: Lecture) => l.id === req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "المحاضرة غير موجودة" });
  }

  const access = checkLectureAccess(authUser, lecture);
  if (!access.hasAccess) {
    return res.status(403).json({ error: access.error });
  }

  // Generate and return secure media token
  const token = generateMediaToken(authUser.uid, lecture.id, 'stream');
  res.json({ success: true, token });
});

// Generate a short-lived, signed token for file downloading
app.post("/api/lectures/:id/download-token", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "يجب تسجيل الدخول أولاً لتحميل الملفات المرفقة" });
  }

  const db = readDB();
  const lecture = db.lectures.find((l: Lecture) => l.id === req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "المحاضرة غير موجودة" });
  }

  const access = checkLectureAccess(authUser, lecture);
  if (!access.hasAccess) {
    return res.status(403).json({ error: access.error });
  }

  // Generate and return secure media token for downloading
  const token = generateMediaToken(authUser.uid, lecture.id, 'download');
  res.json({ success: true, token });
});

// Get Branding settings
app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json({ settings: db.settings });
});

// Save Branding settings
app.post("/api/settings", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const db = readDB();
  db.settings = {
    ...db.settings,
    ...req.body
  };
  writeDB(db);

  res.json({ settings: db.settings });
});

// Upload file directly to Local On-Premise Storage with automatic DB linking
app.post("/api/files/upload", (req, res, next) => {
  // Custom middleware to handle multer errors and ensure we return JSON
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res.status(400).json({ error: "فشل رفع الملف: " + err.message });
    }
    
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "غير مصرح لغير المدراء برفع الملفات" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "لا يوجد ملف تم رفعه" });
    }

    try {
      const { type, lectureId } = req.body;
      // Convert absolute path to relative public URL
      const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
      const fileUrl = `/${relativePath}`;

      // If a lectureId is provided, automatically update the DB for instant sync
      if (lectureId && (type === "video" || type === "attachment")) {
        const db = readDB();
        const lecIndex = db.lectures.findIndex((l: Lecture) => l.id === lectureId);
        if (lecIndex !== -1) {
          if (type === "video") {
            db.lectures[lecIndex].videoUrl = fileUrl;
            db.lectures[lecIndex].videoProvider = "local";
            // NEW: Enhanced Metadata
            db.lectures[lecIndex].videoFileName = req.file.filename; // The name on disk
            db.lectures[lecIndex].videoSize = req.file.size;
            db.lectures[lecIndex].videoExtension = path.extname(req.file.originalname).toLowerCase();
            db.lectures[lecIndex].lastKnownPath = req.file.path;
          } else {
            db.lectures[lecIndex].fileUrl = fileUrl;
            db.lectures[lecIndex].fileName = req.file.originalname;
          }
          writeDB(db);
        }
      }

      res.json({ url: fileUrl, filename: req.file.originalname });
    } catch (error: any) {
      console.error("Upload process error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء معالجة الملف المرفوع" });
    }
  });
});

// --- NEW ON-PREMISE LOCAL FILE SYSTEM ENDPOINTS ---

/**
 * Resolves a requested path within the configured media root folder.
 * Ensures the file exists and is within the allowed scope.
 * ADAPTIVE: Automatically expands the root folder if a valid file is found outside.
 */
function resolveScopedPath(requestedPath: string, autoExpand = true): string | null {
  const db = readDB();
  const rootDir = db.settings.mediaRootFolder || path.join(process.cwd(), "storage");
  
  if (!requestedPath) return null;

  try {
    let absolutePath = "";
    if (path.isAbsolute(requestedPath)) {
      absolutePath = path.normalize(requestedPath);
    } else {
      const relativeToProject = path.join(process.cwd(), requestedPath.startsWith('/') ? requestedPath.substring(1) : requestedPath);
      if (fs.existsSync(relativeToProject)) {
        absolutePath = relativeToProject;
      } else {
        absolutePath = path.join(rootDir, requestedPath);
      }
    }

    const resolvedPath = path.resolve(absolutePath);
    
    // For the local on-premise server, if it's an absolute path that exists, allow it
    if (path.isAbsolute(requestedPath) && fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }

    const resolvedRoot = path.resolve(rootDir);

    // If file exists but is outside the root, try to expand the root automatically
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      if (!resolvedPath.startsWith(resolvedRoot)) {
        if (autoExpand) {
          // Find common parent or just use the parent of the file if root was default
          const parentDir = path.dirname(resolvedPath);
          const currentRoot = db.settings.mediaRootFolder;
          
          let newRoot = parentDir;
          if (currentRoot && fs.existsSync(currentRoot)) {
            newRoot = getCommonParent(currentRoot, resolvedPath) || parentDir;
          }
          
          if (newRoot && newRoot !== currentRoot) {
            console.log(`[AUTO-SYNC] Expanding media root to: ${newRoot}`);
            db.settings.mediaRootFolder = newRoot;
            writeDB(db);
          }
          return resolvedPath;
        }
        console.warn(`Blocked access attempt outside media root: ${resolvedPath} (Root: ${resolvedRoot})`);
        return null;
      }
      return resolvedPath;
    }
  } catch (err) {
    console.error("Error resolving scoped path:", err);
  }
  return null;
}

// Helper to find common parent directory for two paths
function getCommonParent(p1: string, p2: string): string {
  const path1 = path.resolve(p1).split(path.sep);
  const path2 = path.resolve(p2).split(path.sep);
  const common = [];
  for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
    if (path1[i].toLowerCase() === path2[i].toLowerCase()) {
      common.push(path1[i]);
    } else {
      break;
    }
  }
  let commonPath = common.join(path.sep);
  if (!commonPath) {
     return process.platform === 'win32' ? "" : "/";
  }
  if (process.platform === 'win32' && commonPath.length === 2 && commonPath.endsWith(':')) {
     commonPath += '\\';
  }
  return commonPath;
}

function isPathAllowed(filePath: string): boolean {
  const db = readDB();
  const folders = (db.settings.mediaFolders && db.settings.mediaFolders.length > 0) 
    ? db.settings.mediaFolders 
    : [path.join(process.cwd(), "storage")];
  
  const resolvedPath = path.resolve(filePath);
  return folders.some(folder => {
    const resolvedFolder = path.resolve(folder);
    const relative = path.relative(resolvedFolder, resolvedPath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  });
}

// Recursive search for a file in a directory tree (Case-insensitive)
function smartSearchFile(folders: string[], targetFileName: string, targetSize?: number): string | null {
  const targetBaseName = path.basename(targetFileName).toLowerCase();
  
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    try {
      const items = fs.readdirSync(folder);
      for (const item of items) {
        const fullPath = path.join(folder, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          const found = smartSearchFile([fullPath], targetBaseName, targetSize);
          if (found) return found;
        } else if (item.toLowerCase() === targetBaseName) {
          if (!targetSize || Math.abs(stats.size - targetSize) < 1024 * 1024) {
            return fullPath;
          }
        }
      }
    } catch (err) {
      console.error(`Error searching in ${folder}:`, err);
    }
  }
  return null;
}
app.get("/api/env-info", (req, res) => {
  const isCloud = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
  res.json({
    isLocal: !isCloud,
    isCloud: isCloud,
    envType: isCloud ? 'production' : 'local'
  });
});

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimes[ext] || 'application/octet-stream';
}

function streamMedia(req: express.Request, res: express.Response, filePath: string) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "الملف غير موجود على السيرفر" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getMimeType(filePath);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

app.get("/api/media/stream/:lectureId", (req, res) => {
  try {
    const { lectureId } = req.params;
    const db = readDB();
    const lecture = db.lectures.find((l: Lecture) => l.id === lectureId);
    
    if (!lecture) return res.status(404).json({ error: "المحاضرة غير موجودة" });
    if (lecture.videoProvider !== 'local') return res.status(400).json({ error: "هذه المحاضرة ليست فيديو محلي" });

    let videoPath = lecture.videoUrl;
    if (!path.isAbsolute(videoPath)) {
      videoPath = path.join(process.cwd(), videoPath.startsWith('/') ? videoPath.substring(1) : videoPath);
    }

    if (!fs.existsSync(videoPath) || !isPathAllowed(videoPath)) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 
        ? db.settings.mediaFolders 
        : [STORAGE_DIR];
      
      const found = smartSearchFile(folders, lecture.videoFileName || path.basename(videoPath), lecture.videoSize);

      if (found && isPathAllowed(found)) {
        videoPath = found;
      } else {
        return res.status(404).json({ error: "تعذر العثور على ملف الفيديو في المسارات المعرفة أو تم رفض الوصول." });
      }
    }

    streamMedia(req, res, videoPath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/media/attachment/:lectureId", (req, res) => {
  try {
    const { lectureId } = req.params;
    const db = readDB();
    const lecture = db.lectures.find((l: Lecture) => l.id === lectureId);
    
    if (!lecture || !lecture.fileUrl) return res.status(404).json({ error: "المرفق غير موجود" });

    let filePath = lecture.fileUrl;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
    }

    if (!fs.existsSync(filePath) || !isPathAllowed(filePath)) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 
        ? db.settings.mediaFolders 
        : [STORAGE_DIR];
        
      const found = smartSearchFile(folders, lecture.attachmentFileName || lecture.fileName || path.basename(filePath), lecture.attachmentSize);

      if (found && isPathAllowed(found)) {
        filePath = found;
      } else {
        return res.status(404).json({ error: "تعذر العثور على المرفق في المسارات المعرفة أو تم رفض الوصول." });
      }
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(lecture.fileName || path.basename(filePath))}"`);
    streamMedia(req, res, filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Media Audit: Check integrity of all lectures
app.get("/api/admin/media-audit", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const db = readDB();
  const results = db.lectures.map((lecture: Lecture) => {
    if (lecture.videoProvider !== 'local') return { id: lecture.id, title: lecture.title, status: 'external' };

    // Backfill metadata if missing but it is a local file
    if (lecture.videoProvider === 'local' && !lecture.videoFileName && lecture.videoUrl) {
       const baseName = path.basename(lecture.videoUrl);
       if (baseName && baseName !== 'lectures' && baseName !== 'videos') {
         lecture.videoFileName = baseName;
         // Attempt to update the DB in memory for this run
         const idx = db.lectures.findIndex((l: Lecture) => l.id === lecture.id);
         db.lectures[idx].videoFileName = baseName;
       }
    }

    const videoPath = lecture.videoUrl.startsWith('/') 
      ? path.join(process.cwd(), lecture.videoUrl.substring(1))
      : path.normalize(lecture.videoUrl);
    
    let exists = fs.existsSync(videoPath) && fs.statSync(videoPath).isFile();
    let readable = false;
    let autoHealed = false;
    let newPath = "";

    // If not found at recorded path, try smart search
    if (!exists && lecture.videoFileName) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 
        ? db.settings.mediaFolders 
        : [STORAGE_DIR];
        
      let foundPath = smartSearchFile(folders, lecture.videoFileName, lecture.videoSize);

      if (foundPath && isPathAllowed(foundPath)) {
        const relativePath = path.relative(process.cwd(), foundPath).replace(/\\/g, "/");
        newPath = `/${relativePath}`;
        autoHealed = true;
        exists = true;
        
        // Update DB immediately if auto-healed
        db.lectures[db.lectures.findIndex((l: Lecture) => l.id === lecture.id)].videoUrl = newPath;
        db.lectures[db.lectures.findIndex((l: Lecture) => l.id === lecture.id)].lastKnownPath = foundPath;
        writeDB(db);
      }
    }

    if (exists) {
      try {
        const checkPath = autoHealed ? path.join(process.cwd(), newPath.substring(1)) : videoPath;
        fs.accessSync(checkPath, fs.constants.R_OK);
        readable = true;
      } catch (e) {}
    }

    let stats: fs.Stats | null = null;
    try { 
      const checkPath = autoHealed ? (newPath.startsWith('/') ? path.join(process.cwd(), newPath.substring(1)) : newPath) : videoPath;
      stats = fs.statSync(checkPath); 
    } catch (e) {}

    return {
      id: lecture.id,
      title: lecture.title,
      currentPath: lecture.videoUrl,
      resolvedPath: autoHealed ? newPath : videoPath,
      videoFileName: lecture.videoFileName,
      exists,
      readable,
      autoHealed,
      newPath: autoHealed ? newPath : null,
      status: exists ? (readable ? 'ok' : 'locked') : 'missing',
      size: stats?.size,
      extension: stats ? path.extname(lecture.videoUrl) : undefined
    };
  });

  res.json({ audit: results });
});

// Link Local Media without Uploading
app.post("/api/admin/lectures/:id/link-local-media", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { path: filePath, type } = req.body; 

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: "المسار غير صالح أو الملف غير موجود" });
  }

  try {
    const db = readDB();
    const lecIndex = db.lectures.findIndex((l: Lecture) => l.id === id);
    if (lecIndex === -1) return res.status(404).json({ error: "المحاضرة غير موجودة" });

    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (type === 'video') {
      db.lectures[lecIndex].videoUrl = filePath;
      db.lectures[lecIndex].videoProvider = 'local';
      db.lectures[lecIndex].videoFileName = fileName;
      db.lectures[lecIndex].videoSize = stats.size;
      db.lectures[lecIndex].videoExtension = ext;
      db.lectures[lecIndex].lastKnownPath = filePath;
      db.lectures[lecIndex].lastModified = stats.mtime.toISOString();
      db.lectures[lecIndex].fileStatus = 'found';
    } else {
      db.lectures[lecIndex].fileUrl = filePath;
      db.lectures[lecIndex].fileName = fileName;
      db.lectures[lecIndex].attachmentFileName = fileName;
      db.lectures[lecIndex].attachmentSize = stats.size;
      db.lectures[lecIndex].attachmentExtension = ext;
      db.lectures[lecIndex].attachmentLastKnownPath = filePath;
      db.lectures[lecIndex].lastModified = stats.mtime.toISOString();
      db.lectures[lecIndex].fileStatus = 'found';
    }

    writeDB(db);
    res.json({ success: true, lecture: db.lectures[lecIndex] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manage Media Folders
app.post("/api/admin/settings/media-folders", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { folders } = req.body;
  if (!Array.isArray(folders)) return res.status(400).json({ error: "Invalid folders array" });

  const db = readDB();
  db.settings.mediaFolders = folders.filter(f => fs.existsSync(f));
  writeDB(db);
  res.json({ success: true, folders: db.settings.mediaFolders });
});

// Smart Re-link: Try to find a missing file and update its path
app.post("/api/lectures/:id/smart-relink", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const { id } = req.params;
  const db = readDB();
  const lecIndex = db.lectures.findIndex((l: Lecture) => l.id === id);
  
  if (lecIndex === -1) return res.status(404).json({ error: "المحاضرة غير موجودة" });

  const lecture = db.lectures[lecIndex];
  if (lecture.videoProvider !== 'local' || !lecture.videoFileName) {
    return res.status(400).json({ error: "هذه المحاضرة لا تدعم إعادة الربط الذكي" });
  }

  // Try to find the file in the entire storage directory
  const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 
    ? db.settings.mediaFolders 
    : [STORAGE_DIR];
    
  const foundPath = smartSearchFile(folders, lecture.videoFileName, lecture.videoSize);

  if (foundPath && isPathAllowed(foundPath)) {
    const relativePath = path.relative(process.cwd(), foundPath).replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;
    
    db.lectures[lecIndex].videoUrl = fileUrl;
    db.lectures[lecIndex].lastKnownPath = foundPath;
    writeDB(db);

    return res.json({ 
      success: true, 
      message: "تم العثور على الملف وإعادة ربطه بنجاح",
      newPath: fileUrl
    });
  }

  res.status(404).json({ 
    success: false, 
    message: "فشل العثور على الملف في مجلد الوسائط. يرجى التأكد من وجود الملف أو إعادة رفعه." 
  });
});

// Update video path manually
app.post("/api/lectures/:id/update-video-path", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const { id } = req.params;
  const { newPath } = req.body;
  
  if (!newPath) return res.status(400).json({ error: "المسار الجديد مطلوب" });

  const db = readDB();
  const lecIndex = db.lectures.findIndex((l: Lecture) => l.id === id);
  if (lecIndex === -1) return res.status(404).json({ error: "المحاضرة غير موجودة" });

  // Verify if the new path actually exists on the server
  const fullPath = newPath.startsWith('/') 
    ? path.join(process.cwd(), newPath.substring(1))
    : newPath;

  if (!fs.existsSync(fullPath)) {
     return res.status(400).json({ error: "المسار المحدد غير موجود على السيرفر" });
  }

  const stats = fs.statSync(fullPath);
  
  db.lectures[lecIndex].videoUrl = newPath;
  db.lectures[lecIndex].videoFileName = path.basename(fullPath);
  db.lectures[lecIndex].videoSize = stats.size;
  db.lectures[lecIndex].videoExtension = path.extname(fullPath).toLowerCase();
  db.lectures[lecIndex].lastKnownPath = fullPath;
  db.lectures[lecIndex].videoProvider = "local";

  writeDB(db);
  res.json({ success: true, lecture: db.lectures[lecIndex] });
});

// Check if a local file exists on disk and verify permissions
app.get("/api/local-files/check", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.json({ exists: false, readable: false, error: "لم يتم تحديد مسار الملف" });
  }
  try {
    const normalizedPath = path.normalize(filePath);
    const existsReal = fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile();
    
    let readableReal = false;
    let accessErrorMsg = null;
    let errorCode = null;

    if (existsReal) {
      try {
        fs.accessSync(normalizedPath, fs.constants.R_OK);
        readableReal = true;
      } catch (accessErr: any) {
        readableReal = false;
        errorCode = accessErr.code || "EACCES";
        accessErrorMsg = `تعذر قراءة الملف بسبب قيود الوصول أو الصلاحيات البرمجية بالنظام (${accessErr.code})`;
      }
    } else {
      errorCode = "ENOENT";
      accessErrorMsg = "الملف غير موجود في المسار المحدد على القرص الصلب";
    }

    // Disable sandbox simulation to support strict production local-media validation
    res.json({ 
      exists: existsReal,
      readable: readableReal,
      error: accessErrorMsg,
      errorCode: errorCode,
      simulated: false 
    });
  } catch (err: any) {
    res.json({ 
      exists: false, 
      readable: false, 
      error: `فشل التحقق من المسار: ${err.message}`, 
      errorCode: err.code || "UNKNOWN", 
      simulated: false 
    });
  }
});

// Verify all registered files on startup/frequent checks
app.get("/api/local-files/verify-all", (req, res) => {
  const db = readDB();
  const files = db.localFiles || [];
  
  const results = files.map((file: any) => {
    let existsReal = false;
    let size = file.size;
    try {
      const resolved = resolveScopedPath(file.fullPath);
      if (resolved) {
        existsReal = true;
        size = fs.statSync(resolved).size;
      }
    } catch (e) {}
    return {
      ...file,
      exists: existsReal, 
      simulated: !existsReal,
      size
    };
  });

  res.json({ results });
});

app.post("/api/local-files/clear-all", (req, res) => {
  const db = readDB();
  db.localFiles = [];
  writeDB(db);
  res.json({ success: true, message: "تم مسح كافة سجلات الملفات المحلية بنجاح" });
});

// Update file path without creating a new record (Relinking option)
app.post("/api/local-files/update-path", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const { id, lectureId, fileType: reqFileType, newPath } = req.body;
  if (!newPath) {
    return res.status(400).json({ error: "المسار الجديد مطلوب" });
  }

  const db = readDB();
  if (!db.localFiles) db.localFiles = [];
  
  let index = -1;
  if (id) {
    index = db.localFiles.findIndex((f: any) => f.id === id);
  } else if (lectureId && reqFileType) {
    index = db.localFiles.findIndex((f: any) => f.lectureId === lectureId && f.fileType === reqFileType);
  }

  // If we couldn't find a localFile record but we do have lectureId and fileType, 
  // we can create a placeholder localFile record and sync it!
  if (index === -1 && lectureId && reqFileType) {
    const lec = db.lectures.find((l: any) => l.id === lectureId);
    if (lec) {
      const normalized = path.normalize(newPath);
      let size = 0;
      if (fs.existsSync(normalized)) {
        size = fs.statSync(normalized).size;
      }
      const newLF = {
        id: `lf-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        fileName: path.basename(normalized),
        fullPath: normalized,
        fileType: reqFileType,
        size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lectureId: lectureId
      };
      db.localFiles.push(newLF);
      index = db.localFiles.length - 1;
    }
  }

  if (index === -1) {
    return res.status(404).json({ error: "السجل غير موجود، يرجى ربطه بمحاضرة أولاً" });
  }

  try {
    let resolved = resolveScopedPath(newPath);
    
    if (!resolved) {
      // If resolution failed, it might be a valid local file that we need to "adopt"
      if (path.isAbsolute(newPath) && fs.existsSync(newPath)) {
        resolved = resolveScopedPath(newPath, true); // Force auto-expand
      }
    }

    if (!resolved) {
      return res.status(403).json({ error: "المسار المحدد يقع خارج مجلد الوسائط المعتمد أو الملف غير موجود" });
    }

    const stat = fs.statSync(resolved);
    const size = stat.size;

    db.localFiles[index].fullPath = resolved;
    db.localFiles[index].fileName = path.basename(resolved);
    db.localFiles[index].size = size;
    db.localFiles[index].updatedAt = new Date().toISOString();

    // Sync with the associated lecture as well
    const fileType = db.localFiles[index].fileType;
    const lId = db.localFiles[index].lectureId;
    const lecIndex = db.lectures.findIndex((l: any) => l.id === lId);
    if (lecIndex !== -1) {
      if (fileType === 'video') {
        db.lectures[lecIndex].videoUrl = resolved;
        db.lectures[lecIndex].videoProvider = "local";
      } else {
        db.lectures[lecIndex].fileUrl = resolved;
        db.lectures[lecIndex].fileName = path.basename(resolved);
      }
    }

    writeDB(db);
    res.json({ success: true, file: db.localFiles[index] });
  } catch (err: any) {
    res.status(500).json({ error: "فشل تحديث المسار: " + err.message });
  }
});

// Stream any local video file (highly secure, token-authorized, server-side resolved path)
app.get("/api/local-media/stream", (req, res) => {
  const lectureId = req.query.lectureId as string;
  const token = req.query.token as string;

  if (!lectureId || !token) {
    return res.status(401).send("Unauthorized: Missing lectureId or token parameters");
  }

  // Verify signed token specifically for streaming
  const verified = verifyMediaToken(token, 'stream');
  if (!verified || verified.lectureId !== lectureId) {
    return res.status(403).send("Forbidden: Invalid or expired access token");
  }

  const db = readDB();
  const lecture = db.lectures.find((l: any) => l.id === lectureId);
  if (!lecture) {
    return res.status(404).send("Lecture not found");
  }

  const videoPath = lecture.videoUrl;
  if (!videoPath) {
    return res.status(400).send("No video path linked to this lecture");
  }

  // Log user details
  const user = db.users.find((u: any) => u.uid === verified.uid) || { username: 'Guest', email: 'unknown@user.com', role: 'user' };
  logVideoAccess(user.username, user.email, user.role, "STREAM_VIDEO", lecture.title, lecture.id, videoPath);

  try {
    const db = readDB();
    const lecture = db.lectures.find((l: any) => l.id === lectureId);
    if (!lecture) return res.status(404).send("المحاضرة غير موجودة");

    let finalPath = resolveScopedPath(videoPath);

    if (!finalPath) {
      // SMART HEAL: Try to find the file if it was moved
      const fileName = lecture.videoFileName || path.basename(videoPath);
      const rootDir = db.settings.mediaRootFolder || STORAGE_DIR;
      let foundPath = smartSearchFile([rootDir], fileName, lecture.videoSize);
      
      // Also try searching in the original path's parent directory if it's an absolute path
      if (!foundPath && path.isAbsolute(videoPath)) {
        const parentDir = path.dirname(videoPath);
        if (fs.existsSync(parentDir)) {
          foundPath = smartSearchFile([parentDir], fileName, lecture.videoSize);
        }
      }
      
      if (foundPath) {
        // Double check if the found path is within scope
        finalPath = resolveScopedPath(foundPath);
        
        if (finalPath) {
          // Update DB for future requests
          const lecIdx = db.lectures.findIndex((l: any) => l.id === lectureId);
          if (lecIdx !== -1) {
            db.lectures[lecIdx].videoUrl = finalPath; 
            db.lectures[lecIdx].lastKnownPath = finalPath;
            writeDB(db);
          }
        }
      }
      
      if (!finalPath) {
        return res.status(404).send("ملف الفيديو غير موجود بالمجال المصرح به على السيرفر المحلي. الرجاء التأكد من صحة مسار الملف أو نقله إلى مجلد الوسائط المعتمد.");
      }
    }

    const stat = fs.statSync(finalPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Detect MIME type dynamically based on the file extension
    const ext = path.extname(finalPath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.ogg') contentType = 'video/ogg';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mkv') contentType = 'video/x-matroska';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(finalPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(finalPath).pipe(res);
    }
  } catch (err: any) {
    console.error("Local streaming failed:", err);
    res.status(500).send("حدث خطأ أثناء بث ملف الفيديو المحلي: " + err.message);
  }
});

// View/Download any local non-video file (highly secure, token-authorized, server-side resolved path)
app.get("/api/local-media/view", (req, res) => {
  const lectureId = req.query.lectureId as string;
  const token = req.query.token as string;

  if (!lectureId || !token) {
    return res.status(401).send("Unauthorized: Missing lectureId or token parameters");
  }

  // Verify signed token specifically for downloading
  const verified = verifyMediaToken(token, 'download');
  if (!verified || verified.lectureId !== lectureId) {
    return res.status(403).send("Forbidden: Invalid or expired access token");
  }

  const db = readDB();
  const lecture = db.lectures.find((l: any) => l.id === lectureId);
  if (!lecture) {
    return res.status(404).send("Lecture not found");
  }

  const filePath = lecture.fileUrl;
  if (!filePath) {
    return res.status(400).send("No attachment linked to this lecture");
  }

  // Log download activity
  const user = db.users.find((u: any) => u.uid === verified.uid) || { username: 'Guest', email: 'unknown@user.com', role: 'user' };
  logVideoAccess(user.username, user.email, user.role, "DOWNLOAD_ATTACHMENT", lecture.title, lecture.id, filePath);

  try {
    const db = readDB();
    const lecture = db.lectures.find((l: any) => l.id === lectureId);
    if (!lecture) return res.status(404).send("المحاضرة غير موجودة");

    let normalizedPath = resolveScopedPath(filePath);

    if (!normalizedPath) {
       // SMART HEAL: Try to find the file if it was moved
       const fileName = lecture.fileName || path.basename(filePath);
       const rootDir = db.settings.mediaRootFolder || STORAGE_DIR;
       let foundPath = smartSearchFile(rootDir, fileName); 
       
       // Also try searching in the original path's parent directory if it's an absolute path
       if (!foundPath && path.isAbsolute(filePath)) {
         const parentDir = path.dirname(filePath);
         if (fs.existsSync(parentDir)) {
           foundPath = smartSearchFile([parentDir], fileName);
         }
       }

       if (foundPath) {
         // Double check if the found path is within scope
         normalizedPath = resolveScopedPath(foundPath);

         if (normalizedPath) {
           // Update DB
           const lecIdx = db.lectures.findIndex((l: any) => l.id === lectureId);
           if (lecIdx !== -1) {
             db.lectures[lecIdx].fileUrl = normalizedPath;
             writeDB(db);
           }
         }
       }
       
       if (!normalizedPath) {
         return res.status(404).send("الملف المرفق غير موجود بالمجال المصرح به على السيرفر");
       }
    }

    // Set appropriate content type for inline viewing if it's PDF or image
    const stat = fs.statSync(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    }

    res.setHeader('Content-Type', contentType);
    // Support download naming
    const fName = path.basename(normalizedPath);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fName)}"`);

    fs.createReadStream(normalizedPath).pipe(res);
  } catch (err: any) {
    console.error("Local file view failed:", err);
    res.status(500).send("حدث خطأ أثناء تحميل الملف المرفق: " + err.message);
  }
});

// ---------------------------------------------------

// Admin list of users
app.get("/api/admin/users", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const db = readDB();
  res.json({ users: db.users });
});

// Admin update user subscription (manual activation workflow)
app.put("/api/admin/users/:userId/subscription", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const { subscription, subscriptionStatus, pendingSubscriptionType, paymentTxInfo } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex((u: UserProfile) => u.uid === req.params.userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const targetUser = db.users[userIndex];
  
  // Calculate expiry dates if manual activation is performed
  let activationDate = targetUser.subscriptionActivatedAt || "";
  let expiryDate = targetUser.subscriptionExpiresAt || "";

  let maxDl = targetUser.maxDownloads || 10;
  if (subscriptionStatus === "active") {
    const now = new Date();
    const expires = new Date();
    
    if (subscription === "gold") {
      expires.setDate(expires.getDate() + 31);
      maxDl = -1; // Unlimited for Gold
    } else {
      expires.setDate(expires.getDate() + 15);
      // Keep existing or use default 10 for Bronze if none set
      if (maxDl === -1) maxDl = 10; 
    }
    
    activationDate = now.toISOString();
    expiryDate = expires.toISOString();
  } else if (subscriptionStatus === "none") {
    activationDate = "";
    expiryDate = "";
  }

  db.users[userIndex] = {
    ...targetUser,
    subscription,
    subscriptionStatus,
    pendingSubscriptionType: pendingSubscriptionType !== undefined ? pendingSubscriptionType : targetUser.pendingSubscriptionType,
    paymentTxInfo: paymentTxInfo !== undefined ? paymentTxInfo : targetUser.paymentTxInfo,
    subscriptionActivatedAt: activationDate,
    subscriptionExpiresAt: expiryDate,
    maxDownloads: maxDl
  };

  writeDB(db);
  res.json({ profile: db.users[userIndex] });
});

// Admin update user quota (max downloads and reset counter)
app.put("/api/admin/users/:userId/quota", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح لغير المدراء" });
  }

  const { maxDownloads, resetCounter } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex((u: UserProfile) => u.uid === req.params.userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (maxDownloads !== undefined) db.users[userIndex].maxDownloads = maxDownloads;
  if (resetCounter) db.users[userIndex].downloadCounter = 0;

  writeDB(db);
  res.json({ profile: db.users[userIndex] });
});

// Download tracking and quota enforcement
app.post("/api/lectures/:id/download-track", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u: UserProfile) => u.uid === authUser.uid);
  if (userIndex === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const user = db.users[userIndex];
  const lecture = db.lectures.find((l: Lecture) => l.id === req.params.id);

  if (!lecture) {
    return res.status(404).json({ error: "المحاضرة غير موجودة" });
  }

  // Admin and Gold have unlimited downloads
  if (user.role === 'admin' || user.subscription === 'gold') {
    return res.json({ success: true, unlimited: true });
  }

  // Check quota for others (Bronze/None)
  const currentCounter = user.downloadCounter || 0;
  const maxDl = user.maxDownloads || 10;

  if (maxDl !== -1 && currentCounter >= maxDl) {
    return res.status(403).json({ 
      error: "quota_exceeded", 
      message: "لقد استهلكت جميع التحميلات المتاحة لخلفيتك البرونزية، يرجى الترقية للاشتراك الذهبي للتحميل غير المحدود" 
    });
  }

  // Increment counter
  db.users[userIndex].downloadCounter = currentCounter + 1;
  writeDB(db);

  res.json({ success: true, counter: db.users[userIndex].downloadCounter });
});

// Error handling middleware to prevent HTML fallbacks for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith("/api/")) {
    console.error("API Error:", err);
    return res.status(err.status || 500).json({ 
      error: err.message || "حدث خطأ داخلي في السيرفر",
      details: process.env.NODE_ENV !== "production" ? err.stack : undefined
    });
  }
  next(err);
});

// Initialize Vite and setup listening ports
async function startServer() {
  // Serve storage directory as static for direct file access (branding, etc)
  app.use("/storage", express.static(STORAGE_DIR));

  // --- SYSTEM DRIVES / PARTITIONS ---
  app.get("/api/system/drives", (req, res) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

      if (process.platform === 'win32') {
        const drives: string[] = [];
        
        // Attempt 1: Using PowerShell (Modern & Reliable)
        try {
          const output = execSync('powershell "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name"', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
          const detected = output.split(/[\r\n]+/)
            .map(line => line.trim())
            .filter(line => line.length === 1)
            .map(letter => `${letter.toUpperCase()}:`);
          drives.push(...detected);
        } catch (err) {
          console.warn("[SYSTEM] PowerShell drive detection failed");
        }

        // Attempt 2: Using wmic (Classic Fallback)
        try {
          const output = execSync('wmic logicaldisk get name', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
          const detected = output.split(/[\r\n]+/)
            .map(line => line.trim())
            .filter(line => line.length === 2 && line.endsWith(':'))
            .map(d => d.toUpperCase());
          drives.push(...detected);
        } catch (err) {
          console.warn("[SYSTEM] wmic drive detection failed");
        }

        // Attempt 3: fsutil (System tool)
        try {
          const output = execSync('fsutil fsinfo drives', { timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
          const detected = output.match(/[A-Z]:/g);
          if (detected) {
            drives.push(...detected.map(d => d.toUpperCase()));
          }
        } catch (err) {
          console.warn("[SYSTEM] fsutil drive detection failed");
        }

        // Attempt 4: Brute force scan A-Z (Safety Net)
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (const letter of letters) {
          const drive = `${letter}:`;
          try {
            // If already found, skip to save time
            if (drives.includes(drive)) continue;
            
            // Check if drive exists and is accessible
            if (fs.existsSync(drive + "\\")) {
              drives.push(drive);
            }
          } catch (e) {}
        }

        // Final sorting and deduplication
        let finalDrives = [...new Set(drives)].sort((a, b) => a.localeCompare(b));
        
        // If absolutely nothing found (unlikely), default to common ones
        if (finalDrives.length === 0) {
          // Check C: and D: explicitly as last resort
          if (fs.existsSync("C:\\")) finalDrives.push("C:");
          if (fs.existsSync("D:\\")) finalDrives.push("D:");
          if (finalDrives.length === 0) finalDrives.push("C:");
        }

        return res.json({ drives: finalDrives });
      } else {
        return res.json({ drives: ['/'] });
      }
    } catch (error: any) {
      console.error("[SYSTEM] drives error:", error);
      res.status(500).json({ error: "فشل نظام اكتشاف الأقراص: " + error.message });
    }
  });

  // List directory contents for navigation
  app.get("/api/system/ls", (req, res) => {
    try {
      const authUser = getAuthUser(req);
      if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

      let dir = req.query.path as string;
      if (!dir) return res.status(400).json({ error: "Path required" });

      if (dir === 'THIS_PC') {
        try {
          const drivesRes = execSync('wmic logicaldisk get name').toString();
          const drives = drivesRes.split(/[\r\n]+/)
            .map(line => line.trim())
            .filter(line => line.length === 2 && line.endsWith(':'))
            .map(d => d.toUpperCase());
            
          const items = drives.map(d => ({
            name: d,
            isDirectory: true,
            fullPath: d + '\\',
            size: 0,
            mtime: new Date().toISOString(),
            extension: ''
          }));
          return res.json({ currentPath: 'THIS_PC', items, parentPath: null });
        } catch (e) {
          return res.status(500).json({ error: "فشل استرجاع الأقراص" });
        }
      }

      // Handle drive letter navigation (e.g. "D:" -> "D:\")
      if (process.platform === 'win32') {
        if (dir.length === 2 && dir.endsWith(':')) {
          dir = dir + '\\';
        } else if (dir.length === 3 && dir.endsWith(':\\')) {
          // Already root with backslash
        } else {
          dir = path.normalize(dir);
        }
      } else {
        dir = path.normalize(dir);
      }

      if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: "المسار غير موجود أو القرص غير متصل" });
      }

      let stats;
      try {
        stats = fs.statSync(dir);
      } catch (e: any) {
        return res.status(403).json({ error: "لا يمكن قراءة معلومات هذا المسار: " + e.message });
      }

      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "المسار المختار ليس مجلداً" });
      }

      let items: fs.Dirent[] = [];
      try {
        items = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e: any) {
        console.error("[SYSTEM] readdirSync failed:", e);
        let errorMsg = "عذراً، لا تملك صلاحيات كافية لفتح هذا المجلد";
        if (e.code === 'EPERM' || e.code === 'EACCES') errorMsg = "تم رفض الوصول: صلاحيات غير كافية لهذا المجلد أو القرص";
        return res.status(403).json({ error: errorMsg });
      }

      const result = items.map(item => {
        try {
          const fullPath = path.join(dir, item.name);
          // Basic check if item is accessible
          let isDirectory = false;
          let size = 0;
          let mtime = new Date();

          try {
            // Use lstat to avoid issues with broken symlinks
            const s = fs.lstatSync(fullPath);
            isDirectory = s.isDirectory();
            size = s.size;
            mtime = s.mtime;
          } catch (e) {
            // Skip items that throw errors (permission denied etc)
            return null;
          }

          return {
            name: item.name,
            isDirectory,
            fullPath,
            size,
            mtime: mtime.toISOString(),
            extension: isDirectory ? '' : path.extname(item.name).toLowerCase().substring(1)
          };
        } catch (e) { return null; }
      }).filter((item): item is any => 
        item !== null && 
        !item.name.startsWith('$') && 
        !item.name.startsWith('.') &&
        item.name !== 'System Volume Information' &&
        item.name !== 'RECYCLE.BIN'
      );
      
      // Sort: Directories first, then by name
      result.sort((a: any, b: any) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });

      res.json({ 
        currentPath: dir,
        items: result,
        parentPath: path.dirname(dir) !== dir ? path.dirname(dir) : null
      });
    } catch (err: any) {
      console.error("[SYSTEM] ls error:", err);
      let message = "حدث خطأ أثناء قراءة المجلد";
      if (err.code === 'EACCES') message = "عذراً، لا تملك صلاحيات كافية للوصول لهذا المجلد";
      if (err.code === 'ENOENT') message = "المجلد لم يعد موجوداً";
      
      res.status(500).json({ error: `${message} (${err.code || 'UNKNOWN'})` });
    }
  });

  // Mount Vite middleware for dev or standard express serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ON-PREMISE LOCAL SERVER] Running successfully on port ${PORT}`);
  });
}

startServer();
