var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/app.ts
var import_config2 = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var import_crypto = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);

// server/config/helmet.ts
var import_helmet = __toESM(require("helmet"), 1);
var helmetConfig = (0, import_helmet.default)({
  contentSecurityPolicy: false,
  // Disabled for local Vite dev server compatibility
  crossOriginEmbedderPolicy: false
});

// server/config/cors.ts
var import_cors = __toESM(require("cors"), 1);
var corsConfig = (0, import_cors.default)();

// server/middleware/rateLimiter.ts
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var rateLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 500,
  // Limit each IP to 500 requests per window
  message: "\u0644\u0642\u062F \u062A\u062C\u0627\u0648\u0632\u062A \u062D\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B.",
  standardHeaders: true,
  legacyHeaders: false
});

// server/utils/logger.ts
var logger = {
  info: (message) => console.log(`[INFO] ${(/* @__PURE__ */ new Date()).toISOString()}: ${message}`),
  error: (message, error) => console.error(`[ERROR] ${(/* @__PURE__ */ new Date()).toISOString()}: ${message}`, error),
  warn: (message) => console.warn(`[WARN] ${(/* @__PURE__ */ new Date()).toISOString()}: ${message}`)
};

// server/config/env.ts
var import_config = require("dotenv/config");
var env = {
  PORT: Number(process.env.PORT) || 3e3,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "building-makers-super-secret-key-2026",
  IS_CLOUD: process.env.NODE_ENV === "production" || !!process.env.K_SERVICE
};

// server/middleware/error.ts
var errorHandler = (err, req, res, next) => {
  logger.error(err.message, err);
  res.status(err.status || 500).json({
    error: err.message,
    details: env.NODE_ENV !== "production" ? err.stack : void 0
  });
};

// server/services/backupService.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_archiver = require("archiver");
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var BACKUP_DIR = import_path.default.join(DATA_DIR, "backups");
var DB_FILE = import_path.default.join(DATA_DIR, "db.json");
var MAX_BACKUPS = 10;
async function createBackup() {
  if (!import_fs.default.existsSync(BACKUP_DIR)) import_fs.default.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.zip`;
  const backupFilePath = import_path.default.join(BACKUP_DIR, backupFileName);
  const output = import_fs.default.createWriteStream(backupFilePath);
  const archive = new import_archiver.ZipArchive({ zlib: { level: 9 } });
  return new Promise((resolve, reject) => {
    output.on("close", () => {
      maintainBackupRotation();
      resolve(backupFileName);
    });
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(DB_FILE, { name: "db.json" });
    archive.finalize();
  });
}
function maintainBackupRotation() {
  const files = import_fs.default.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".zip")).map((f) => ({ name: f, time: import_fs.default.statSync(import_path.default.join(BACKUP_DIR, f)).mtime.getTime() })).sort((a, b) => b.time - a.time);
  if (files.length > MAX_BACKUPS) {
    files.slice(MAX_BACKUPS).forEach((f) => import_fs.default.unlinkSync(import_path.default.join(BACKUP_DIR, f.name)));
  }
}
function restoreBackup(backupFileName) {
  const backupFilePath = import_path.default.join(BACKUP_DIR, backupFileName);
  if (!import_fs.default.existsSync(backupFilePath)) throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
  import_fs.default.copyFileSync(backupFilePath, DB_FILE);
}

// server/app.ts
var app = (0, import_express.default)();
app.set("trust proxy", 1);
app.use(helmetConfig);
app.use(corsConfig);
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/", rateLimiter);
var DATA_DIR2 = import_path2.default.join(process.cwd(), "data");
var STORAGE_DIR = import_path2.default.join(process.cwd(), "storage");
var DB_FILE2 = import_path2.default.join(DATA_DIR2, "db.json");
var CURRENT_SCHEMA_VERSION = 2;
if (!import_fs2.default.existsSync(DATA_DIR2)) import_fs2.default.mkdirSync(DATA_DIR2, { recursive: true });
if (!import_fs2.default.existsSync(STORAGE_DIR)) import_fs2.default.mkdirSync(STORAGE_DIR, { recursive: true });
var subDirs = ["videos", "attachments", "thumbnails", "branding"];
subDirs.forEach((dir) => {
  const d = import_path2.default.join(STORAGE_DIR, dir);
  if (!import_fs2.default.existsSync(d)) import_fs2.default.mkdirSync(d, { recursive: true });
});
var SEED_CATEGORIES = [
  { id: "car-maintenance", name: "\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A", description: "\u0623\u0633\u0627\u0633\u064A\u0627\u062A \u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A\u060C \u062A\u0634\u062E\u064A\u0635 \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0628\u0627\u0644\u0643\u0645\u0628\u064A\u0648\u062A\u0631\u060C \u0648\u062A\u0635\u0644\u064A\u062D \u0627\u0644\u0645\u062D\u0631\u0643\u0627\u062A \u0648\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u0623\u0645\u0627\u0646 \u0627\u0644\u062D\u062F\u064A\u062B\u0629." },
  { id: "graphics-effects", name: "\u0627\u0644\u062C\u0631\u0627\u0641\u064A\u0643 \u0648\u0627\u0644\u0623\u0641\u062A\u0631 \u0625\u0641\u0643\u062A", description: "\u0635\u0646\u0627\u0639\u0629 \u0627\u0644\u0645\u0624\u062B\u0631\u0627\u062A \u0627\u0644\u0628\u0635\u0631\u064A\u0629\u060C \u0627\u0644\u0623\u0646\u064A\u0645\u064A\u0634\u0646 \u0627\u0644\u0627\u062D\u062A\u0631\u0627\u0641\u064A\u060C \u0648\u0645\u0648\u0646\u062A\u0627\u062C \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 Photoshop \u0648 Adobe After Effects." },
  { id: "electronics", name: "\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A \u0648\u0627\u0644\u062F\u0648\u0627\u0626\u0631", description: "\u0641\u0647\u0645 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629\u060C \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u062E\u0637\u0637\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629\u060C \u0642\u064A\u0627\u0633 \u0627\u0644\u0645\u0643\u0648\u0646\u0627\u062A\u060C \u0648\u062A\u0635\u0645\u064A\u0645 \u0627\u0644\u062F\u0648\u0627\u0626\u0631 \u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0629 PCB." },
  { id: "arduino-programming", name: "\u0627\u0644\u0623\u0631\u062F\u0648\u064A\u0646\u0648 \u0648\u0627\u0644\u0628\u0631\u0645\u062C\u0629", description: "\u0625\u0646\u062A\u0631\u0646\u062A \u0627\u0644\u0623\u0634\u064A\u0627\u0621 (IoT)\u060C \u0628\u0631\u0645\u062C\u0629 \u0627\u0644\u0645\u064A\u0643\u0631\u0648\u0643\u0646\u062A\u0631\u0648\u0644\u0631\u060C \u0648\u0628\u0646\u0627\u0621 \u0645\u0634\u0627\u0631\u064A\u0639 \u0630\u0643\u064A\u0629 \u062A\u0641\u0627\u0639\u0644\u064A\u0629 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0644\u063A\u0629 C++ \u0648\u0645\u062A\u062D\u0643\u0645\u0627\u062A Arduino." }
];
var SEED_LECTURES = [
  {
    id: "lec-car-1",
    categoryId: "car-maintenance",
    title: "\u0643\u064A\u0641 \u062A\u0639\u0645\u0644 \u0634\u0645\u0639\u0627\u062A \u0627\u0644\u0627\u062D\u062A\u0631\u0627\u0642 (\u0628\u0648\u062C\u064A\u0647\u0627\u062A \u0627\u0644\u0633\u064A\u0627\u0631\u0629) \u0648\u0645\u062A\u0649 \u064A\u062C\u0628 \u062A\u063A\u064A\u064A\u0631\u0647\u0627\u061F",
    description: "\u0634\u0631\u062D \u0645\u0641\u0635\u0644 \u0648\u0645\u0628\u0633\u0637 \u062D\u0648\u0644 \u0646\u0638\u0631\u064A\u0629 \u0639\u0645\u0644 \u0634\u0645\u0639\u0627\u062A \u0627\u0644\u0627\u062D\u062A\u0631\u0627\u0642 \u0628\u062F\u0627\u062E\u0644 \u063A\u0631\u0641 \u0627\u0644\u0645\u062D\u0631\u0643\u060C \u0627\u0644\u0623\u0639\u0631\u0627\u0636 \u0627\u0644\u0634\u0647\u064A\u0631\u0629 \u0644\u062A\u0644\u0641\u0647\u0627\u060C \u0648\u0637\u0631\u064A\u0642\u0629 \u0641\u062D\u0635\u0647\u0627 \u0628\u0645\u0642\u0627\u064A\u064A\u0633 \u0647\u0646\u062F\u0633\u064A\u0629 \u062F\u0642\u064A\u0642\u0629 \u0644\u062A\u062C\u0646\u0628 \u0647\u062F\u0631 \u0627\u0644\u0648\u0642\u0648\u062F.",
    videoUrl: "https://www.youtube.com/watch?v=FjIuCAn6fT0",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/car-spark-plugs-guide/spark_plugs_workbook.pdf",
    fileName: "\u0643\u062A\u064A\u0628 \u0635\u064A\u0627\u0646\u0629 \u0634\u0645\u0639\u0627\u062A \u0627\u0644\u0627\u062D\u062A\u0631\u0627\u0642.pdf",
    tierRequired: "free"
  },
  {
    id: "lec-car-2",
    categoryId: "car-maintenance",
    title: "\u0641\u062D\u0635 \u0627\u0644\u062D\u0633\u0627\u0633\u0627\u062A \u0648\u062A\u0634\u062E\u064A\u0635 \u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u062C\u0647\u0627\u0632 OBD-II",
    description: "\u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629\u060C \u0646\u062A\u0639\u0644\u0645 \u0633\u0648\u064A\u0627\u064B \u0643\u064A\u0641\u064A\u0629 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u062A\u062D\u0630\u064A\u0631\u064A\u0629 \u0648\u062D\u0644 \u0645\u0634\u0643\u0644\u0629 \u0644\u0645\u0628\u0629 \u0627\u0644\u0645\u062D\u0631\u0643 (Check Engine) \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0623\u062C\u0647\u0632\u0629 OBD-II \u0644\u0644\u0645\u062D\u062A\u0631\u0641\u064A\u0646.",
    videoUrl: "https://www.youtube.com/watch?v=Yf-V_kC-h5s",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/obd2-fault-codes/OBD2_Diagnostic_Codes.pdf",
    fileName: "\u062C\u062F\u0648\u0644 \u0623\u0643\u0648\u0627\u062F \u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A OBD.pdf",
    tierRequired: "bronze"
  },
  {
    id: "lec-graphics-1",
    categoryId: "graphics-effects",
    title: "\u0623\u0633\u0627\u0633\u064A\u0627\u062A \u0627\u0644\u0623\u0641\u062A\u0631 \u0625\u0641\u0643\u062A \u0648\u0635\u0646\u0627\u0639\u0629 \u0623\u0648\u0644 \u0645\u0634\u0647\u062F \u0623\u0646\u064A\u0645\u064A\u0634\u0646 \u0644\u0644\u0645\u0628\u062A\u062F\u0626\u064A\u0646",
    description: "\u0641\u0647\u0645 \u0648\u0627\u062C\u0647\u0629 \u0628\u0631\u0646\u0627\u0645\u062C Adobe After Effects\u060C \u0634\u0631\u062D \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0643\u0648\u0645\u0628\u0648\u0632\u064A\u0634\u0646 \u0648\u0627\u0644\u062A\u0627\u064A\u0645\u0644\u0627\u064A\u0646\u060C \u0648\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0643\u064A-\u0641\u0631\u064A\u0645\u0632 \u0644\u0625\u0646\u0634\u0627\u0621 \u0645\u0624\u062B\u0631\u0627\u062A \u0628\u0635\u0631\u064A\u0629 \u0645\u0630\u0647\u0644\u0629 \u0648\u062D\u0631\u0643\u0629 \u0646\u0627\u0639\u0645\u0629.",
    videoUrl: "https://www.youtube.com/watch?v=0h94hT9nK8o",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/after-effects-shortcuts/ae_shortcuts.pdf",
    fileName: "\u0627\u062E\u062A\u0635\u0627\u0631\u0627\u062A \u0644\u0648\u062D\u0629 \u0645\u0641\u0627\u062A\u064A\u062D \u0627\u0644\u0623\u0641\u062A\u0631 \u0625\u0641\u0643\u062A.pdf",
    tierRequired: "free"
  },
  {
    id: "lec-graphics-2",
    categoryId: "graphics-effects",
    title: "\u062A\u062D\u0631\u064A\u0643 \u0627\u0644\u0646\u0635\u0648\u0635 \u0648\u0627\u0644\u0634\u0639\u0627\u0631\u0627\u062A \u062B\u0644\u0627\u062B\u064A\u0629 \u0627\u0644\u0623\u0628\u0639\u0627\u062F \u0628\u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0640 Kinetic Typography",
    description: "\u0634\u0631\u062D \u0643\u0627\u0645\u0644 \u0644\u0623\u062F\u0648\u0627\u062A \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629 \u0628\u0628\u0631\u0646\u0627\u0645\u062C After Effects \u0648\u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0638\u0644\u0627\u0644 \u0627\u0644\u0648\u0627\u0642\u0639\u064A\u0629 \u0648\u062A\u062D\u0631\u064A\u0643 \u0627\u0644\u0643\u0627\u0645\u064A\u0631\u0627 \u0644\u0635\u0646\u0627\u0639\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0648\u0627\u0644\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062A\u062D\u0631\u0643\u0629.",
    videoUrl: "https://www.youtube.com/watch?v=LqUa2XqB1V8",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/kinetic-typography-project/kinetic_typography.zip",
    fileName: "\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0648\u0627\u0644\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u062C\u0627\u0647\u0632\u0629.zip",
    tierRequired: "gold"
  },
  {
    id: "lec-elec-1",
    categoryId: "electronics",
    title: "\u0642\u0627\u0646\u0648\u0646 \u0623\u0648\u0645 \u0648\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0645\u0642\u0627\u0648\u0645\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0644\u064A \u0648\u0627\u0644\u062A\u0648\u0627\u0632\u064A",
    description: "\u0627\u0644\u062F\u0631\u0633 \u0627\u0644\u062A\u0623\u0633\u064A\u0633\u064A \u0641\u064A \u0639\u0644\u0645 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A\u060C \u0634\u0631\u062D \u0645\u0641\u0627\u0647\u064A\u0645 \u0627\u0644\u062C\u0647\u062F\u060C \u0627\u0644\u062A\u064A\u0627\u0631\u060C \u0648\u0627\u0644\u0645\u0642\u0627\u0648\u0645\u0629\u060C \u0648\u0643\u064A\u0641\u064A\u0629 \u062D\u0633\u0627\u0628 \u0627\u0644\u0641\u0648\u0644\u062A \u0628\u062F\u0627\u062E\u0644 \u0627\u0644\u062F\u0648\u0627\u0626\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0629.",
    videoUrl: "https://www.youtube.com/watch?v=gS6oE5jU358",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/electronics-basics-ohm/ohms_law_exercises.pdf",
    fileName: "\u062A\u0645\u0627\u0631\u064A\u0646 \u0648\u0645\u0633\u0627\u0626\u0644 \u0645\u062D\u0644\u0648\u0644\u0629 \u0641\u064A \u0642\u0627\u0646\u0648\u0646 \u0623\u0648\u0645.pdf",
    tierRequired: "free"
  },
  {
    id: "lec-arduino-1",
    categoryId: "arduino-programming",
    title: "\u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0633\u0631\u064A\u0639\u0629 \u0645\u0639 \u0627\u0644\u0623\u0631\u062F\u0648\u064A\u0646\u0648: \u0643\u062A\u0627\u0628\u0629 \u0643\u0648\u062F \u0628\u0644\u064A\u0646\u0643 \u0644\u0644\u062A\u062D\u0643\u0645 \u0628\u0627\u0644\u0640 LED",
    description: "\u0634\u0631\u062D \u0627\u0644\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u0637\u0648\u064A\u0631\u064A\u0629 \u0627\u0644\u0623\u0631\u062F\u0648\u064A\u0646\u0648 \u0623\u0648\u0646\u0648\u060C \u062A\u062D\u0645\u064A\u0644 \u0628\u0631\u0646\u0627\u0645\u062C Arduino IDE\u060C \u0648\u0643\u062A\u0627\u0628\u0629 \u0643\u0648\u062F \u0628\u0631\u0645\u062C\u064A \u0628\u0644\u063A\u0629 C++ \u0644\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0627\u0644\u0625\u0636\u0627\u0621\u0629 \u0639\u0628\u0631 \u0627\u0644\u0645\u0646\u0627\u0641\u0630 \u0627\u0644\u0631\u0642\u0645\u064A\u0629.",
    videoUrl: "https://www.youtube.com/watch?v=nL346W7Be9U",
    videoProvider: "youtube",
    fileUrl: "https://archive.org/download/arduino-guide-beginners/arduino_starter.pdf",
    fileName: "\u062F\u0644\u064A\u0644 \u062A\u062C\u0627\u0631\u0628 \u0627\u0644\u0623\u0631\u062F\u0648\u064A\u0646\u0648 \u0644\u0644\u0645\u0628\u062A\u062F\u0626\u064A\u0646.pdf",
    tierRequired: "free"
  }
];
var DEFAULT_CONFIG = {
  siteName: "Building Makers",
  logoUrl: "",
  logoWidth: 160,
  logoHeight: 40,
  logoPadding: 0,
  fontFamily: "Cairo",
  heroMediaUrl: "",
  heroMediaType: "image",
  heroOpacity: 60,
  heroBlur: 2,
  mainTitle: "\u0645\u0646\u0635\u0629 \u062F\u0631\u0627\u0633\u064A\u0629 \u0645\u062A\u0637\u0648\u0631\u0629 100% \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 | \u0628\u0648\u0627\u0628\u062A\u0643 \u0627\u0644\u0630\u0643\u064A\u0629 \u0644\u0627\u062D\u062A\u0631\u0627\u0641 \u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0642\u0646\u064A\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u064A\u0629",
  subTitle: "\u062A\u0639\u0644\u0645 \u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A\u060C \u0627\u0644\u062C\u0631\u0627\u0641\u064A\u0643\u060C \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A\u060C \u0648\u0627\u0644\u0628\u0631\u0645\u062C\u0629 \u0645\u0639 \u0646\u062E\u0628\u0629 \u0645\u0646 \u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646 \u0627\u0644\u062E\u0628\u0631\u0627\u0621 \u0648\u0627\u0644\u0645\u0647\u0646\u064A\u064A\u0646.",
  primaryColor: "#f97316",
  mediaRootFolder: import_path2.default.join(process.cwd(), "storage"),
  mediaFolders: [import_path2.default.join(process.cwd(), "storage")],
  paymentDetails: {
    walletNumbers: [
      { name: "\u0631\u0642\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 (\u0623\u0648\u0631\u0646\u062C \u0643\u0627\u0634)", number: "01226188108", provider: "\u0623\u0648\u0631\u0646\u062C \u0643\u0627\u0634 Orange Cash" },
      { name: "\u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0625\u0646\u0633\u062A\u0627 \u0628\u0627\u064A InstaPay", number: "01226188108", provider: "\u0625\u0646\u0633\u062A\u0627 \u0628\u0627\u064A InstaPay" }
    ]
  }
};
function readDB() {
  if (!import_fs2.default.existsSync(DB_FILE2)) {
    const initialData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      users: [],
      categories: SEED_CATEGORIES,
      lectures: SEED_LECTURES,
      settings: DEFAULT_CONFIG,
      localFiles: []
    };
    import_fs2.default.writeFileSync(DB_FILE2, JSON.stringify(initialData, null, 2), "utf8");
    return initialData;
  }
  try {
    const raw = import_fs2.default.readFileSync(DB_FILE2, "utf8");
    const parsed = JSON.parse(raw);
    let updated = false;
    if (!parsed.schemaVersion) {
      parsed.schemaVersion = CURRENT_SCHEMA_VERSION;
      updated = true;
    }
    if (!parsed.localFiles) {
      parsed.localFiles = [];
      updated = true;
    }
    if (!parsed.settings) {
      parsed.settings = DEFAULT_CONFIG;
      updated = true;
    }
    if (!parsed.settings.mediaRootFolder) {
      parsed.settings.mediaRootFolder = import_path2.default.join(process.cwd(), "storage");
      updated = true;
    }
    if (!parsed.settings.mediaFolders) {
      parsed.settings.mediaFolders = [parsed.settings.mediaRootFolder || import_path2.default.join(process.cwd(), "storage")];
      updated = true;
    }
    if (parsed.settings && parsed.settings.paymentDetails && parsed.settings.paymentDetails.walletNumbers) {
      const hasOldDummy = parsed.settings.paymentDetails.walletNumbers.some(
        (w) => w.number === "01002345678" || w.number === "lms@instapay"
      );
      if (hasOldDummy) {
        parsed.settings = { ...parsed.settings, ...DEFAULT_CONFIG };
        updated = true;
      }
    }
    const now = Date.now();
    if (parsed.users) {
      parsed.users = parsed.users.map((u) => {
        if (u.subscriptionStatus === "active" && u.subscriptionExpiresAt) {
          const expiryTime = new Date(u.subscriptionExpiresAt).getTime();
          if (expiryTime < now) {
            u.subscriptionStatus = "none";
            u.subscription = "none";
            updated = true;
          }
        }
        return u;
      });
    }
    if (updated) {
      import_fs2.default.writeFileSync(DB_FILE2, JSON.stringify(parsed, null, 2), "utf8");
    }
    return parsed;
  } catch (err) {
    console.error("Error reading Local DB file:", err);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      users: [],
      categories: SEED_CATEGORIES,
      lectures: SEED_LECTURES,
      settings: DEFAULT_CONFIG,
      localFiles: []
    };
  }
}
function writeDB(data) {
  try {
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
    const tempPath = DB_FILE2 + ".tmp";
    import_fs2.default.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    import_fs2.default.renameSync(tempPath, DB_FILE2);
  } catch (err) {
    console.error("Error writing Local DB file:", err);
  }
}
var JWT_SECRET = process.env.JWT_SECRET || "building-makers-super-secret-key-2026";
function generateToken(uid) {
  const signature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(uid).digest("hex");
  return `${uid}.${signature}`;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [uid, signature] = parts;
  const expectedSignature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(uid).digest("hex");
  if (signature === expectedSignature) {
    return uid;
  }
  return null;
}
function generateMediaToken(uid, lectureId, type) {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1e3;
  const payload = JSON.stringify({ uid, lectureId, type, expiresAt });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${signature}`;
}
function verifyMediaToken(token, requiredType) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSignature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(payloadB64).digest("hex");
  if (signature !== expectedSignature) return null;
  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const { uid, lectureId, type, expiresAt } = JSON.parse(payloadJson);
    if (type !== requiredType) return null;
    if (Date.now() > expiresAt) return null;
    return { uid, lectureId };
  } catch (err) {
    return null;
  }
}
function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  let uid = verifyToken(token);
  if (!uid) {
    if (process.env.NODE_ENV !== "production") {
      uid = token;
    } else {
      return null;
    }
  }
  const db = readDB();
  return db.users.find((u) => u.uid === uid) || null;
}
function checkLectureAccess(user, lecture) {
  if (!user) {
    return { hasAccess: false, error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u062D\u062A\u0648\u0649" };
  }
  if (user.role === "admin") {
    return { hasAccess: true };
  }
  if (user.subscriptionStatus === "blocked") {
    return { hasAccess: false, error: "\u062D\u0633\u0627\u0628\u0643 \u0645\u062D\u0638\u0648\u0631 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645" };
  }
  const tierMap = {
    free: 0,
    bronze: 1,
    gold: 2
  };
  const requiredTier = lecture.tierRequired || "free";
  const requiredVal = tierMap[requiredTier] || 0;
  if (requiredVal === 0) {
    return { hasAccess: true };
  }
  if (user.subscriptionStatus !== "active") {
    return { hasAccess: false, error: "\u064A\u062C\u0628 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A" };
  }
  if (user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt).getTime();
    if (expiresAt < Date.now()) {
      return { hasAccess: false, error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0634\u062A\u0631\u0627\u0643\u0643. \u064A\u0631\u062C\u0649 \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0644\u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0628\u0627\u0644\u0645\u0634\u0627\u0647\u062F\u0629" };
    }
  }
  const userTier = user.subscription || "none";
  const userVal = tierMap[userTier] || 0;
  if (userVal < requiredVal) {
    return { hasAccess: false, error: `\u0647\u0630\u0627 \u0627\u0644\u062F\u0631\u0633 \u064A\u062A\u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A \u0627\u0644\u0628\u0627\u0642\u0629 ${requiredTier === "bronze" ? "\u0627\u0644\u0628\u0631\u0648\u0646\u0632\u064A\u0629" : "\u0627\u0644\u0630\u0647\u0628\u064A\u0629"} \u0623\u0648 \u0623\u0639\u0644\u0649` };
  }
  return { hasAccess: true };
}
function logVideoAccess(username, email, role, actionType, lectureTitle, lectureId, filePath) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const logMessage = `[${timestamp}] User: ${username} (${email}), Role: ${role}, Action: ${actionType}, Lecture: "${lectureTitle}" (ID: ${lectureId}), FilePath: "${filePath}"
`;
  try {
    const logFilePath = import_path2.default.join(DATA_DIR2, "video_access.log");
    import_fs2.default.appendFileSync(logFilePath, logMessage, "utf8");
    console.log(`Video Access Logged: ${logMessage.trim()}`);
  } catch (err) {
    console.error("Failed to write to video access log file:", err);
  }
}
var storageConfig = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    try {
      const type = req.query.type || "general";
      let targetDir = STORAGE_DIR;
      if (type === "video") {
        targetDir = import_path2.default.join(STORAGE_DIR, "videos");
      } else if (type === "attachment") {
        targetDir = import_path2.default.join(STORAGE_DIR, "attachments");
      } else if (type === "thumbnail") {
        targetDir = import_path2.default.join(STORAGE_DIR, "thumbnails");
      } else if (type === "branding") {
        targetDir = import_path2.default.join(STORAGE_DIR, "branding");
      }
      if (!import_fs2.default.existsSync(targetDir)) {
        import_fs2.default.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } catch (err) {
      cb(err, STORAGE_DIR);
    }
  },
  filename: (req, file, cb) => {
    let decodedName = file.originalname;
    try {
      decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    } catch (e) {
    }
    const fileExt = import_path2.default.extname(decodedName);
    const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `file-${uniqueId}${fileExt}`);
  }
});
var upload = (0, import_multer.default)({
  storage: storageConfig,
  limits: { fileSize: 1024 * 1024 * 1024 * 5 },
  // 5GB limit for large local files
  fileFilter: (req, file, cb) => {
    let decodedName = file.originalname;
    try {
      decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    } catch (e) {
    }
    const fileExt = import_path2.default.extname(decodedName).toLowerCase();
    const allowedExtensions = [
      ".mp4",
      ".m4v",
      ".mov",
      ".avi",
      ".mkv",
      ".webm",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".pdf",
      ".zip",
      ".rar",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".txt",
      ".csv"
    ];
    if (!allowedExtensions.includes(fileExt)) {
      return cb(new Error("\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0631\u0641\u062A\u0647 \u0644\u0623\u0633\u0628\u0627\u0628 \u0623\u0645\u0646\u064A\u0629."));
    }
    cb(null, true);
  }
});
function isPathSafe(filePath) {
  try {
    const normalized = import_path2.default.normalize(filePath).toLowerCase();
    const blockedFolders = [
      "c:\\windows",
      "c:\\winnt",
      "c:\\program files",
      "c:\\program files (x86)",
      "c:\\users\\all users",
      "c:\\recovery",
      "\\system volume information",
      "\\$recycle.bin"
    ];
    if (blockedFolders.some((f) => normalized.startsWith(f))) {
      return { safe: false, error: "\u0645\u062C\u0644\u062F \u0646\u0638\u0627\u0645 \u0645\u062D\u0645\u064A" };
    }
    const sensitiveFiles = [".env", "db.json", "server.ts", "package.json", "package-lock.json"];
    const fileName = import_path2.default.basename(normalized);
    if (sensitiveFiles.includes(fileName)) {
      return { safe: false, error: "\u0645\u0644\u0641 \u0646\u0638\u0627\u0645 \u062D\u0633\u0627\u0633" };
    }
    return { safe: true };
  } catch (e) {
    return { safe: false, error: "\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
  }
}
function getContentType(filePath) {
  const ext = import_path2.default.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] || "application/octet-stream";
}
function resolveScopedPath(requestedPath, autoExpand = true) {
  const db = readDB();
  const rootDir = db.settings.mediaRootFolder || import_path2.default.join(process.cwd(), "storage");
  if (!requestedPath) return null;
  try {
    let absolutePath = "";
    if (import_path2.default.isAbsolute(requestedPath)) {
      absolutePath = import_path2.default.normalize(requestedPath);
    } else {
      const relativeToProject = import_path2.default.join(process.cwd(), requestedPath.startsWith("/") ? requestedPath.substring(1) : requestedPath);
      if (import_fs2.default.existsSync(relativeToProject)) {
        absolutePath = relativeToProject;
      } else {
        absolutePath = import_path2.default.join(rootDir, requestedPath);
      }
    }
    const resolvedPath = import_path2.default.resolve(absolutePath);
    if (import_path2.default.isAbsolute(requestedPath) && import_fs2.default.existsSync(resolvedPath)) {
      return resolvedPath;
    }
    const resolvedRoot = import_path2.default.resolve(rootDir);
    if (import_fs2.default.existsSync(resolvedPath) && import_fs2.default.statSync(resolvedPath).isFile()) {
      if (!resolvedPath.startsWith(resolvedRoot)) {
        if (autoExpand) {
          const parentDir = import_path2.default.dirname(resolvedPath);
          const currentRoot = db.settings.mediaRootFolder;
          let newRoot = parentDir;
          if (currentRoot && import_fs2.default.existsSync(currentRoot)) {
            newRoot = getCommonParent(currentRoot, resolvedPath) || parentDir;
          }
          if (newRoot && newRoot !== currentRoot) {
            console.log(`[AUTO-SYNC] Expanding media root to: ${newRoot}`);
            db.settings.mediaRootFolder = newRoot;
            writeDB(db);
          }
          return resolvedPath;
        }
        return null;
      }
      return resolvedPath;
    }
  } catch (err) {
    console.error("Error resolving scoped path:", err);
  }
  return null;
}
function getCommonParent(p1, p2) {
  const path1 = import_path2.default.resolve(p1).split(import_path2.default.sep);
  const path22 = import_path2.default.resolve(p2).split(import_path2.default.sep);
  const common = [];
  for (let i = 0; i < Math.min(path1.length, path22.length); i++) {
    if (path1[i].toLowerCase() === path22[i].toLowerCase()) {
      common.push(path1[i]);
    } else {
      break;
    }
  }
  let commonPath = common.join(import_path2.default.sep);
  if (!commonPath) {
    return process.platform === "win32" ? "" : "/";
  }
  if (process.platform === "win32" && commonPath.length === 2 && commonPath.endsWith(":")) {
    commonPath += "\\";
  }
  return commonPath;
}
function isPathAllowed(filePath) {
  const safety = isPathSafe(filePath);
  if (!safety.safe) {
    return false;
  }
  const db = readDB();
  const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [import_path2.default.join(process.cwd(), "storage")];
  const resolvedPath = import_path2.default.resolve(filePath).toLowerCase();
  const isInAllowedFolder = folders.some((folder) => {
    const resolvedFolder = import_path2.default.resolve(folder);
    const relative = import_path2.default.relative(resolvedFolder, resolvedPath);
    return !relative.startsWith("..") && !import_path2.default.isAbsolute(relative);
  });
  if (isInAllowedFolder) {
    return true;
  }
  const isRegistered = db.lectures.some((l) => {
    const matchesFileUrl = l.fileUrl && import_path2.default.resolve(l.fileUrl).toLowerCase() === resolvedPath;
    const matchesVideoUrl = l.videoUrl && import_path2.default.resolve(l.videoUrl).toLowerCase() === resolvedPath;
    const matchesLastKnown = l.lastKnownPath && import_path2.default.resolve(l.lastKnownPath).toLowerCase() === resolvedPath;
    return matchesFileUrl || matchesVideoUrl || matchesLastKnown;
  });
  if (isRegistered) {
    return true;
  }
  const isLocalFile = db.localFiles && db.localFiles.some((f) => {
    return f.fullPath && import_path2.default.resolve(f.fullPath).toLowerCase() === resolvedPath;
  });
  return !!isLocalFile;
}
function smartSearchFile(folders, targetFileName, targetSize) {
  const targetBaseName = import_path2.default.basename(targetFileName).toLowerCase();
  for (const folder of folders) {
    if (!import_fs2.default.existsSync(folder)) continue;
    try {
      const items = import_fs2.default.readdirSync(folder);
      for (const item of items) {
        const fullPath = import_path2.default.join(folder, item);
        const stats = import_fs2.default.statSync(fullPath);
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
function streamMedia(req, res, filePath) {
  if (!import_fs2.default.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  const stat = import_fs2.default.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getContentType(filePath);
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize) {
      res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize);
      return;
    }
    const chunksize = end - start + 1;
    const file = import_fs2.default.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    };
    res.writeHead(200, head);
    import_fs2.default.createReadStream(filePath).pipe(res);
  }
}
app.use("/storage", import_express.default.static(STORAGE_DIR));
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "running", mode: "local_on_premise" }
  });
});
app.get("/api/profile", (req, res) => {
  res.redirect(302, "/api/auth/profile");
});
app.get("/api/env-info", (req, res) => {
  const isCloud = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;
  res.json({
    isLocal: !isCloud,
    isCloud,
    envType: isCloud ? "production" : "local"
  });
});
app.get("/api/video/check", (req, res) => {
  const filePath = req.query.path || req.query.id;
  if (!filePath) {
    return res.json({ exists: false, readable: false, error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0644\u0641" });
  }
  try {
    const normalizedPath = import_path2.default.normalize(filePath);
    const existsReal = import_fs2.default.existsSync(normalizedPath) && import_fs2.default.statSync(normalizedPath).isFile();
    let readableReal = false;
    let accessErrorMsg = null;
    let errorCode = null;
    if (existsReal) {
      try {
        import_fs2.default.accessSync(normalizedPath, import_fs2.default.constants.R_OK);
        readableReal = true;
      } catch (accessErr) {
        readableReal = false;
        errorCode = accessErr.code || "EACCES";
        accessErrorMsg = `\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u0644\u0641 \u0628\u0633\u0628\u0628 \u0642\u064A\u0648\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0623\u0648 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0628\u0631\u0645\u062C\u064A\u0629 \u0628\u0627\u0644\u0646\u0638\u0627\u0645 (${accessErr.code})`;
      }
    } else {
      errorCode = "ENOENT";
      accessErrorMsg = "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u0639\u0644\u0649 \u0627\u0644\u0642\u0631\u0635 \u0627\u0644\u0635\u0644\u0628";
    }
    res.json({
      exists: existsReal,
      readable: readableReal,
      error: accessErrorMsg,
      errorCode,
      simulated: false
    });
  } catch (err) {
    res.json({
      exists: false,
      readable: false,
      error: `\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0633\u0627\u0631: ${err.message}`,
      errorCode: err.code || "UNKNOWN",
      simulated: false
    });
  }
});
app.get("/api/video/stream", (req, res) => {
  const lectureId = req.query.id || req.query.lectureId;
  const token = req.query.token;
  if (!lectureId || !token) {
    return res.status(401).send("Unauthorized: Missing id or token parameters");
  }
  const verified = verifyMediaToken(token, "stream");
  if (!verified || verified.lectureId !== lectureId) {
    return res.status(403).send("Forbidden: Invalid or expired access token");
  }
  const db = readDB();
  const lecture = db.lectures.find((l) => l.id === lectureId);
  if (!lecture) {
    return res.status(404).send("Lecture not found");
  }
  const user = db.users.find((u) => u.uid === verified.uid);
  const access = checkLectureAccess(user || null, lecture);
  if (!access.hasAccess) {
    return res.status(403).send(access.error || "Forbidden: Subscription required");
  }
  const videoPath = lecture.videoUrl;
  if (!videoPath) {
    return res.status(400).send("No video path linked to this lecture");
  }
  const activeUser = user || { username: "Guest", email: "unknown@user.com", role: "user" };
  logVideoAccess(activeUser.username, activeUser.email, activeUser.role, "STREAM_VIDEO", lecture.title, lecture.id, videoPath);
  try {
    let finalPath = resolveScopedPath(videoPath);
    if (!finalPath) {
      const fileName = lecture.videoFileName || import_path2.default.basename(videoPath);
      const rootDir = db.settings.mediaRootFolder || STORAGE_DIR;
      let foundPath = smartSearchFile([rootDir], fileName, lecture.videoSize);
      if (!foundPath && import_path2.default.isAbsolute(videoPath)) {
        const parentDir = import_path2.default.dirname(videoPath);
        if (import_fs2.default.existsSync(parentDir)) {
          foundPath = smartSearchFile([parentDir], fileName, lecture.videoSize);
        }
      }
      if (foundPath) {
        finalPath = resolveScopedPath(foundPath);
        if (finalPath) {
          const lecIdx = db.lectures.findIndex((l) => l.id === lectureId);
          if (lecIdx !== -1) {
            db.lectures[lecIdx].videoUrl = finalPath;
            db.lectures[lecIdx].lastKnownPath = finalPath;
            writeDB(db);
          }
        }
      }
      if (!finalPath) {
        return res.status(404).send("\u0645\u0644\u0641 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0645\u062C\u0627\u0644 \u0627\u0644\u0645\u0635\u0631\u062D \u0628\u0647 \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0645\u062D\u0644\u064A. \u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0635\u062D\u0629 \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0646\u0642\u0644\u0647 \u0625\u0644\u0649 \u0645\u062C\u0644\u062F \u0627\u0644\u0648\u0633\u0627\u0626\u0637 \u0627\u0644\u0645\u0639\u062A\u0645\u062F.");
      }
    }
    const stat = import_fs2.default.statSync(finalPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = import_path2.default.extname(finalPath).toLowerCase();
    let contentType = "video/mp4";
    if (ext === ".webm") contentType = "video/webm";
    else if (ext === ".ogg") contentType = "video/ogg";
    else if (ext === ".mov") contentType = "video/quicktime";
    else if (ext === ".mkv") contentType = "video/x-matroska";
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize) {
        res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize);
        return;
      }
      const chunksize = end - start + 1;
      const file = import_fs2.default.createReadStream(finalPath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Cache-Control": "no-cache"
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      };
      res.writeHead(200, head);
      import_fs2.default.createReadStream(finalPath).pipe(res);
    }
  } catch (err) {
    console.error("Local streaming failed:", err);
    res.status(500).send("\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0628\u062B \u0645\u0644\u0641 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0627\u0644\u0645\u062D\u0644\u064A: " + err.message);
  }
});
app.get("/api/videos/stream", (req, res) => {
  try {
    const videoPath = req.query.path;
    if (!videoPath) {
      return res.status(400).send("Path is required");
    }
    const fullPath = import_path2.default.resolve(videoPath);
    const safety = isPathSafe(fullPath);
    if (!safety.safe) {
      return res.status(403).send(`Access denied: ${safety.error}`);
    }
    if (!import_fs2.default.existsSync(fullPath)) {
      return res.status(404).send("File not found");
    }
    streamMedia(req, res, fullPath);
  } catch (error) {
    res.status(500).send("Error during video streaming");
  }
});
app.get("/api/auth/profile", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u062F\u062E\u0648\u0644" } });
  }
  res.json({ success: true, profile: user, data: { profile: user } });
});
app.post("/api/auth/register", (req, res) => {
  const { email, username, role } = req.body;
  if (!email || !username) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "\u064A\u0631\u062C\u0649 \u062A\u0639\u0628\u0626\u0629 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629" } });
  }
  try {
    const db = readDB();
    const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, error: { code: "CONFLICT", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644" } });
    }
    const isFirstUser = db.users.length === 0;
    const newUser = {
      uid: "usr-" + Date.now() + "-" + Math.round(Math.random() * 1e3),
      username,
      email: email.toLowerCase(),
      role: isFirstUser ? "admin" : role || "user",
      subscription: "none",
      subscriptionStatus: "none",
      pendingSubscriptionType: "none",
      paymentTxInfo: null,
      downloadCounter: 0,
      maxDownloads: 10,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.users.push(newUser);
    writeDB(db);
    res.json({
      success: true,
      token: generateToken(newUser.uid),
      profile: newUser,
      data: { profile: newUser, token: generateToken(newUser.uid) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "\u064A\u0631\u062C\u0649 \u062A\u0648\u0641\u064A\u0631 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" } });
  }
  try {
    const db = readDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0623\u0648\u0644\u0627\u064B" } });
    }
    res.json({
      success: true,
      token: generateToken(user.uid),
      profile: user,
      data: { profile: user, token: generateToken(user.uid) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  if (!clientId) {
    return res.status(400).json({ error: "Google Client ID not configured on server" });
  }
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
  res.json({ url });
});
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing auth code");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth Client ID or Client Secret not configured on server");
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) {
      throw new Error("Failed to exchange code for tokens");
    }
    const tokens = await tokenRes.json();
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!userinfoRes.ok) {
      throw new Error("Failed to fetch user info");
    }
    const profile = await userinfoRes.json();
    const email = profile.email;
    const name = profile.name || profile.given_name || "Google User";
    if (!email) {
      return res.status(400).send("No email associated with Google account");
    }
    const db = readDB();
    let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = {
        uid: "google-usr-" + Date.now(),
        username: name,
        email: email.toLowerCase(),
        role: db.users.length === 0 ? "admin" : "user",
        subscription: "none",
        subscriptionStatus: "none",
        pendingSubscriptionType: "none",
        paymentTxInfo: null,
        downloadCounter: 0,
        maxDownloads: 10,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.users.push(user);
      writeDB(db);
    }
    const token = generateToken(user.uid);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Authentication</title></head>
      <body>
        <script>
          window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: '${token}', profile: ${JSON.stringify(user)} }, '*');
          window.close();
        </script>
        <p>Authentication complete. You can close this window now.</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Authentication Failed</title></head>
      <body>
        <script>
          window.opener.postMessage({ type: 'GOOGLE_AUTH_FAILURE', error: '${err.message}' }, '*');
          window.close();
        </script>
        <p>Authentication failed: ${err.message}. You can close this window now.</p>
      </body>
      </html>
    `);
  }
});
app.post("/api/auth/google", (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "\u0628\u0631\u064A\u062F \u062C\u0648\u062C\u0644 \u0645\u0637\u0644\u0648\u0628" } });
  }
  try {
    const db = readDB();
    let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = {
        uid: "google-usr-" + Date.now(),
        username: name || "\u0645\u0633\u062A\u062E\u062F\u0645 Google",
        email: email.toLowerCase(),
        role: db.users.length === 0 ? "admin" : "user",
        subscription: "none",
        subscriptionStatus: "none",
        pendingSubscriptionType: "none",
        paymentTxInfo: null,
        downloadCounter: 0,
        maxDownloads: 10,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.users.push(user);
      writeDB(db);
    }
    res.json({
      success: true,
      token: generateToken(user.uid),
      profile: user,
      data: { profile: user, token: generateToken(user.uid) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.put("/api/auth/profile", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u062F\u062E\u0648\u0644" } });
  }
  try {
    const db = readDB();
    const userIndex = db.users.findIndex((u) => u.uid === authUser.uid);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } });
    }
    const allowedKeys = ["username", "subscriptionStatus", "pendingSubscriptionType", "paymentTxInfo"];
    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== void 0) {
        if (key === "subscriptionStatus") {
          const val = req.body[key];
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
    res.json({ success: true, profile: db.users[userIndex], data: { profile: db.users[userIndex] } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.get("/api/categories", (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, data: { categories: db.categories || [] } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/categories", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  const { id, name, description, imageUrl, previewUrl } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0642\u0633\u0645 \u0645\u0637\u0644\u0648\u0628" } });
  }
  try {
    const db = readDB();
    const index = db.categories.findIndex((c) => c.id === id);
    const newCat = {
      id: id || "cat-" + Date.now(),
      name,
      description: description || "",
      imageUrl: imageUrl || "",
      previewUrl: previewUrl || "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (index !== -1) {
      db.categories[index] = newCat;
    } else {
      db.categories.push(newCat);
    }
    writeDB(db);
    res.json({ success: true, category: newCat, data: { category: newCat } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.delete("/api/categories/:id", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const db = readDB();
    db.categories = db.categories.filter((c) => c.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.get("/api/lectures", (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, data: { lectures: db.lectures || [] } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/lectures", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  const { id, categoryId, title, description, videoUrl, videoProvider, fileUrl, fileName, tierRequired, thumbnailUrl } = req.body;
  if (!title || !categoryId) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0631\u0633 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629" } });
  }
  try {
    const db = readDB();
    const index = db.lectures.findIndex((l) => l.id === id);
    const newLec = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (index !== -1) {
      db.lectures[index] = {
        ...db.lectures[index],
        ...newLec,
        createdAt: db.lectures[index].createdAt || newLec.createdAt
      };
    } else {
      db.lectures.push(newLec);
    }
    if (!db.localFiles) db.localFiles = [];
    db.localFiles = db.localFiles.filter((lf) => lf.lectureId !== newLec.id);
    const checkAndAddLocalFile = (filePath, type) => {
      if (!filePath) return;
      const isLocal = filePath.startsWith("/") || filePath.includes("\\") || filePath.includes(":");
      if (isLocal) {
        try {
          const normalized = import_path2.default.normalize(filePath);
          const resolved = resolveScopedPath(normalized, true);
          let size = 0;
          let exists = !!resolved;
          if (exists && resolved) {
            const stats = import_fs2.default.statSync(resolved);
            size = stats.size;
          }
          const fName = import_path2.default.basename(normalized);
          db.localFiles.push({
            id: `lf-${Date.now()}-${Math.round(Math.random() * 1e3)}`,
            fileName: fName,
            fullPath: normalized,
            fileType: type,
            size,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            lectureId: newLec.id
          });
        } catch (err) {
          console.error("Error adding local file stats:", err);
        }
      }
    };
    if (newLec.videoUrl && newLec.videoProvider === "local") {
      checkAndAddLocalFile(newLec.videoUrl, "video");
    }
    if (newLec.fileUrl) {
      checkAndAddLocalFile(newLec.fileUrl, newLec.fileUrl.toLowerCase().endsWith(".pdf") ? "pdf" : "attachment");
    }
    writeDB(db);
    res.json({ success: true, lecture: db.lectures.find((l) => l.id === newLec.id), data: { lecture: db.lectures.find((l) => l.id === newLec.id) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.delete("/api/lectures/:id", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const db = readDB();
    db.lectures = db.lectures.filter((l) => l.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/lectures/:id/thumbnail", (req, res) => {
  const { id } = req.params;
  const { thumbnailDataUrl } = req.body;
  if (!thumbnailDataUrl) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0635\u063A\u0631\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  try {
    const db = readDB();
    const index = db.lectures.findIndex((l) => l.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    }
    const matches = thumbnailDataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
    }
    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const data = Buffer.from(matches[2], "base64");
    const filename = `thumb-${id}-${Date.now()}.${ext}`;
    const destPath = import_path2.default.join(STORAGE_DIR, "thumbnails", filename);
    import_fs2.default.writeFileSync(destPath, data);
    const relativeUrl = `/storage/thumbnails/${filename}`;
    db.lectures[index].thumbnailUrl = relativeUrl;
    writeDB(db);
    res.json({ success: true, thumbnailUrl: relativeUrl });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0635\u063A\u0631\u0629: " + err.message });
  }
});
app.post("/api/lectures/:id/stream-token", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0628\u062B" });
  }
  const db = readDB();
  const lecture = db.lectures.find((l) => l.id === req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  const access = checkLectureAccess(authUser, lecture);
  if (!access.hasAccess) {
    return res.status(403).json({ error: access.error });
  }
  const token = generateMediaToken(authUser.uid, lecture.id, "stream");
  res.json({ success: true, token });
});
app.post("/api/lectures/:id/download-token", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0631\u0641\u0642\u0629" });
  }
  const db = readDB();
  const lecture = db.lectures.find((l) => l.id === req.params.id);
  if (!lecture) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  const access = checkLectureAccess(authUser, lecture);
  if (!access.hasAccess) {
    return res.status(403).json({ error: access.error });
  }
  const token = generateMediaToken(authUser.uid, lecture.id, "download");
  res.json({ success: true, token });
});
app.get("/api/settings", (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, data: { settings: db.settings } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/settings", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const db = readDB();
    db.settings = { ...db.settings, ...req.body };
    writeDB(db);
    res.json({ success: true, settings: db.settings, data: { settings: db.settings } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/files/upload", upload.single("file"), (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621 \u0628\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0644\u0641 \u062A\u0645 \u0631\u0641\u0639\u0647" });
  }
  try {
    const { type, lectureId } = req.body;
    const relativePath = import_path2.default.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;
    let originalName = req.file.originalname;
    try {
      originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    } catch (e) {
    }
    if (lectureId && (type === "video" || type === "attachment")) {
      const db = readDB();
      const lecIndex = db.lectures.findIndex((l) => l.id === lectureId);
      if (lecIndex !== -1) {
        if (type === "video") {
          db.lectures[lecIndex].videoUrl = fileUrl;
          db.lectures[lecIndex].videoProvider = "local";
          db.lectures[lecIndex].videoFileName = req.file.filename;
          db.lectures[lecIndex].videoSize = req.file.size;
          db.lectures[lecIndex].videoExtension = import_path2.default.extname(originalName).toLowerCase();
          db.lectures[lecIndex].lastKnownPath = req.file.path;
        } else {
          db.lectures[lecIndex].fileUrl = fileUrl;
          db.lectures[lecIndex].fileName = originalName;
        }
        writeDB(db);
      }
    }
    res.json({ url: fileUrl, filename: originalName, path: fileUrl });
  } catch (error) {
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u0641\u0648\u0639" });
  }
});
app.get("/api/system/drives", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  try {
    if (process.platform === "win32") {
      const drives = [];
      try {
        const output = (0, import_child_process.execSync)('powershell "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name"', { timeout: 3e3, stdio: ["pipe", "pipe", "ignore"] }).toString();
        const detected = output.split(/[\r\n]+/).map((line) => line.trim()).filter((line) => line.length === 1).map((letter) => `${letter.toUpperCase()}:`);
        drives.push(...detected);
      } catch (err) {
        console.warn("PowerShell drives check failed, attempting wmic...");
      }
      try {
        const output = (0, import_child_process.execSync)("wmic logicaldisk get name", { timeout: 3e3, stdio: ["pipe", "pipe", "ignore"] }).toString();
        const detected = output.split(/[\r\n]+/).map((line) => line.trim()).filter((line) => line.length === 2 && line.endsWith(":")).map((d) => d.toUpperCase());
        drives.push(...detected);
      } catch (err) {
        console.warn("WMIC check failed.");
      }
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      for (const letter of letters) {
        const drive = `${letter}:`;
        try {
          if (drives.includes(drive)) continue;
          if (import_fs2.default.existsSync(drive + "\\")) {
            drives.push(drive);
          }
        } catch (e) {
        }
      }
      const finalDrives = [...new Set(drives)].sort((a, b) => a.localeCompare(b));
      if (finalDrives.length === 0) {
        if (import_fs2.default.existsSync("C:\\")) finalDrives.push("C:");
        if (import_fs2.default.existsSync("D:\\")) finalDrives.push("D:");
        if (finalDrives.length === 0) finalDrives.push("C:");
      }
      res.json({ drives: finalDrives });
    } else {
      res.json({ drives: ["/"] });
    }
  } catch (error) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0646\u0638\u0627\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u0623\u0642\u0631\u0627\u0635: " + error.message });
  }
});
app.get("/api/system/ls", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  let dir = req.query.path;
  if (!dir) return res.status(400).json({ error: "Path required" });
  if (dir === "THIS_PC") {
    try {
      const drivesRes = (0, import_child_process.execSync)("wmic logicaldisk get name").toString();
      const drives = drivesRes.split(/[\r\n]+/).map((line) => line.trim()).filter((line) => line.length === 2 && line.endsWith(":")).map((d) => d.toUpperCase());
      const items = drives.map((d) => ({
        name: d,
        isDirectory: true,
        fullPath: d + "\\",
        size: 0,
        mtime: (/* @__PURE__ */ new Date()).toISOString(),
        extension: ""
      }));
      return res.json({ currentPath: "THIS_PC", items, parentPath: null });
    } catch (e) {
      const items = [{
        name: "C:",
        isDirectory: true,
        fullPath: "C:\\",
        size: 0,
        mtime: (/* @__PURE__ */ new Date()).toISOString(),
        extension: ""
      }];
      return res.json({ currentPath: "THIS_PC", items, parentPath: null });
    }
  }
  if (process.platform === "win32") {
    if (dir.length === 2 && dir.endsWith(":")) {
      dir = dir + "\\";
    } else {
      dir = import_path2.default.normalize(dir);
    }
  } else {
    dir = import_path2.default.normalize(dir);
  }
  if (!import_fs2.default.existsSync(dir)) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0627\u0644\u0642\u0631\u0635 \u063A\u064A\u0631 \u0645\u062A\u0635\u0644" });
  }
  try {
    const stats = import_fs2.default.statSync(dir);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u0644\u064A\u0633 \u0645\u062C\u0644\u062F\u0627\u064B" });
    }
    let items = [];
    try {
      items = import_fs2.default.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      let errorMsg = "\u0639\u0630\u0631\u0627\u064B\u060C \u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0643\u0627\u0641\u064A\u0629 \u0644\u0641\u062A\u062D \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F";
      if (e.code === "EPERM" || e.code === "EACCES") {
        errorMsg = "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0648\u0635\u0648\u0644: \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F \u0623\u0648 \u0627\u0644\u0642\u0631\u0635 (Permission Denied)";
      }
      return res.status(403).json({ error: errorMsg });
    }
    const result = items.map((item) => {
      try {
        const fullPath = import_path2.default.join(dir, item.name);
        let isDirectory = false;
        let size = 0;
        let mtime = /* @__PURE__ */ new Date();
        try {
          const s = import_fs2.default.lstatSync(fullPath);
          isDirectory = s.isDirectory();
          size = s.size;
          mtime = s.mtime;
        } catch (e) {
          return null;
        }
        return {
          name: item.name,
          isDirectory,
          fullPath,
          size,
          mtime: mtime.toISOString(),
          extension: isDirectory ? "" : import_path2.default.extname(item.name).toLowerCase().substring(1)
        };
      } catch (e) {
        return null;
      }
    }).filter(
      (item) => item !== null && !item.name.startsWith("$") && !item.name.startsWith(".") && item.name !== "System Volume Information" && item.name !== "RECYCLE.BIN"
    );
    result.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    res.json({
      currentPath: dir,
      items: result,
      parentPath: import_path2.default.dirname(dir) !== dir ? import_path2.default.dirname(dir) : null
    });
  } catch (err) {
    let message = "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u062C\u0644\u062F";
    if (err.code === "EACCES") message = "\u0639\u0630\u0631\u0627\u064B\u060C \u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0643\u0627\u0641\u064A\u0629 \u0644\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F";
    if (err.code === "ENOENT") message = "\u0627\u0644\u0645\u062C\u0644\u062F \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u0627\u064B";
    res.status(500).json({ error: `${message} (${err.code || "UNKNOWN"})` });
  }
});
app.get("/api/system/native-picker", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  const isVideo = req.query.type === "video";
  let command = "";
  if (process.platform === "win32") {
    const filter = isVideo ? "Video Files (*.mp4;*.mkv;*.avi;*.mov;*.webm)|*.mp4;*.mkv;*.avi;*.mov;*.webm" : "All Files (*.*)|*.*";
    command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = '${filter}'; $f.ShowDialog() | Out-Null; $f.FileName"`;
  } else if (process.platform === "darwin") {
    command = `osascript -e 'POSIX path of (choose file)'`;
  } else {
    try {
      (0, import_child_process.execSync)("which zenity", { stdio: "ignore" });
      command = `zenity --file-selection`;
    } catch (e) {
      return res.status(500).json({
        error: "\u0628\u064A\u0626\u0629 \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0644\u0627 \u062A\u062F\u0639\u0645 \u0646\u0627\u0641\u0630\u0629 \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645. \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0645\u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u062F\u0645\u062C.",
        isHeadless: true
      });
    }
  }
  (0, import_child_process.exec)(command, (error, stdout) => {
    if (error) {
      return res.status(500).json({ error: "\u0641\u0634\u0644 \u0641\u062A\u062D \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062A. \u062A\u0623\u0643\u062F \u0645\u0646 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0645\u062D\u0644\u064A\u0627\u064B." });
    }
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return res.json({ cancelled: true });
    }
    res.json({ success: true, path: selectedPath });
  });
});
app.post("/api/system/verify-path", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  const { path: targetPath } = req.body;
  if (!targetPath) return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0645\u0637\u0644\u0648\u0628" });
  try {
    const normalizedPath = import_path2.default.normalize(targetPath);
    if (import_fs2.default.existsSync(normalizedPath)) {
      const stats = import_fs2.default.statSync(normalizedPath);
      return res.json({
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        name: import_path2.default.basename(normalizedPath)
      });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/lectures/:id/link-local-media", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { path: filePath, type } = req.body;
  if (!filePath || !import_fs2.default.existsSync(filePath)) {
    return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  try {
    const db = readDB();
    const lecIndex = db.lectures.findIndex((l) => l.id === id);
    if (lecIndex === -1) return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    const stats = import_fs2.default.statSync(filePath);
    const fileName = import_path2.default.basename(filePath);
    const ext = import_path2.default.extname(filePath).toLowerCase();
    if (type === "video") {
      db.lectures[lecIndex].videoUrl = filePath;
      db.lectures[lecIndex].videoProvider = "local";
      db.lectures[lecIndex].videoFileName = fileName;
      db.lectures[lecIndex].videoSize = stats.size;
      db.lectures[lecIndex].videoExtension = ext;
      db.lectures[lecIndex].lastKnownPath = filePath;
    } else {
      db.lectures[lecIndex].fileUrl = filePath;
      db.lectures[lecIndex].fileName = fileName;
    }
    writeDB(db);
    res.json({ success: true, lecture: db.lectures[lecIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/settings/media-folders", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  const { folders } = req.body;
  if (!Array.isArray(folders)) return res.status(400).json({ error: "Invalid folders array" });
  try {
    const db = readDB();
    db.settings.mediaFolders = folders.filter((f) => import_fs2.default.existsSync(f));
    writeDB(db);
    res.json({ success: true, folders: db.settings.mediaFolders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/lectures/:id/smart-relink", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const { id } = req.params;
  try {
    const db = readDB();
    const lecIndex = db.lectures.findIndex((l) => l.id === id);
    if (lecIndex === -1) return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    const lecture = db.lectures[lecIndex];
    if (lecture.videoProvider !== "local" || !lecture.videoFileName) {
      return res.status(400).json({ error: "\u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u0644\u0627 \u062A\u062F\u0639\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0630\u0643\u064A" });
    }
    const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [STORAGE_DIR];
    const foundPath = smartSearchFile(folders, lecture.videoFileName, lecture.videoSize);
    if (foundPath && isPathAllowed(foundPath)) {
      const relativePath = import_path2.default.relative(process.cwd(), foundPath).replace(/\\/g, "/");
      const fileUrl = `/${relativePath}`;
      db.lectures[lecIndex].videoUrl = fileUrl;
      db.lectures[lecIndex].lastKnownPath = foundPath;
      writeDB(db);
      return res.json({
        success: true,
        message: "\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0648\u0625\u0639\u0627\u062F\u0629 \u0631\u0628\u0637\u0647 \u0628\u0646\u062C\u0627\u062D",
        newPath: fileUrl
      });
    }
    res.status(404).json({
      success: false,
      message: "\u0641\u0634\u0644 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0641\u064A \u0645\u062C\u0644\u062F \u0627\u0644\u0648\u0633\u0627\u0626\u0637. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0648\u062C\u0648\u062F \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0625\u0639\u0627\u062F\u0629 \u0631\u0641\u0639\u0647."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/lectures/:id/update-video-path", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const { id } = req.params;
  const { newPath } = req.body;
  if (!newPath) return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0637\u0644\u0648\u0628" });
  try {
    const db = readDB();
    const lecIndex = db.lectures.findIndex((l) => l.id === id);
    if (lecIndex === -1) return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    const fullPath = newPath.startsWith("/") ? import_path2.default.join(process.cwd(), newPath.substring(1)) : newPath;
    if (!import_fs2.default.existsSync(fullPath)) {
      return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u0631\u0641\u0631" });
    }
    const stats = import_fs2.default.statSync(fullPath);
    db.lectures[lecIndex].videoUrl = newPath;
    db.lectures[lecIndex].videoFileName = import_path2.default.basename(fullPath);
    db.lectures[lecIndex].videoSize = stats.size;
    db.lectures[lecIndex].videoExtension = import_path2.default.extname(fullPath).toLowerCase();
    db.lectures[lecIndex].lastKnownPath = fullPath;
    db.lectures[lecIndex].videoProvider = "local";
    writeDB(db);
    res.json({ success: true, lecture: db.lectures[lecIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/local-files/check", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.json({ exists: false, readable: false, error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0644\u0641" });
  }
  try {
    const normalizedPath = import_path2.default.normalize(filePath);
    const existsReal = import_fs2.default.existsSync(normalizedPath) && import_fs2.default.statSync(normalizedPath).isFile();
    let readableReal = false;
    let accessErrorMsg = null;
    let errorCode = null;
    if (existsReal) {
      try {
        import_fs2.default.accessSync(normalizedPath, import_fs2.default.constants.R_OK);
        readableReal = true;
      } catch (accessErr) {
        readableReal = false;
        errorCode = accessErr.code || "EACCES";
        accessErrorMsg = `\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u0644\u0641 \u0628\u0633\u0628\u0628 \u0642\u064A\u0648\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0623\u0648 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0628\u0631\u0645\u062C\u064A\u0629 \u0644\u0644\u0646\u0638\u0627\u0645 (${accessErr.code})`;
      }
    } else {
      errorCode = "ENOENT";
      accessErrorMsg = "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u0639\u0644\u0649 \u0627\u0644\u0642\u0631\u0635 \u0627\u0644\u0635\u0644\u0628";
    }
    res.json({
      exists: existsReal,
      readable: readableReal,
      error: accessErrorMsg,
      errorCode,
      simulated: false
    });
  } catch (err) {
    res.json({ exists: false, readable: false, error: err.message, simulated: false });
  }
});
app.get("/api/local-files/verify-all", (req, res) => {
  try {
    const db = readDB();
    const files = db.localFiles || [];
    const results = files.map((file) => {
      let existsReal = false;
      let size = file.size;
      try {
        const resolved = resolveScopedPath(file.fullPath);
        if (resolved) {
          existsReal = true;
          size = import_fs2.default.statSync(resolved).size;
        }
      } catch (e) {
      }
      return {
        ...file,
        exists: existsReal,
        simulated: !existsReal,
        size
      };
    });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/local-files/clear-all", (req, res) => {
  try {
    const db = readDB();
    db.localFiles = [];
    writeDB(db);
    res.json({ success: true, message: "\u062A\u0645 \u0645\u0633\u062D \u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0628\u0646\u062C\u0627\u062D" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/local-files/update-path", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" });
  const { id, lectureId, fileType: reqFileType, newPath } = req.body;
  if (!newPath) return res.status(400).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0637\u0644\u0648\u0628" });
  try {
    const db = readDB();
    if (!db.localFiles) db.localFiles = [];
    let index = -1;
    if (id) {
      index = db.localFiles.findIndex((f) => f.id === id);
    } else if (lectureId && reqFileType) {
      index = db.localFiles.findIndex((f) => f.lectureId === lectureId && f.fileType === reqFileType);
    }
    if (index === -1 && lectureId && reqFileType) {
      const lec = db.lectures.find((l) => l.id === lectureId);
      if (lec) {
        const normalized = import_path2.default.normalize(newPath);
        let size = 0;
        if (import_fs2.default.existsSync(normalized)) {
          size = import_fs2.default.statSync(normalized).size;
        }
        const newLF = {
          id: `lf-${Date.now()}-${Math.round(Math.random() * 1e3)}`,
          fileName: import_path2.default.basename(normalized),
          fullPath: normalized,
          fileType: reqFileType,
          size,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lectureId
        };
        db.localFiles.push(newLF);
        index = db.localFiles.length - 1;
      }
    }
    if (index === -1) {
      return res.status(404).json({ error: "\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u060C \u064A\u0631\u062C\u0649 \u0631\u0628\u0637\u0647 \u0628\u0645\u062D\u0627\u0636\u0631\u0629 \u0623\u0648\u0644\u0627\u064B" });
    }
    let resolved = resolveScopedPath(newPath);
    if (!resolved && import_path2.default.isAbsolute(newPath) && import_fs2.default.existsSync(newPath)) {
      resolved = resolveScopedPath(newPath, true);
    }
    if (!resolved) {
      return res.status(403).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u064A\u0642\u0639 \u062E\u0627\u0631\u062C \u0645\u062C\u0644\u062F \u0627\u0644\u0648\u0633\u0627\u0626\u0637 \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    }
    const stat = import_fs2.default.statSync(resolved);
    db.localFiles[index].fullPath = resolved;
    db.localFiles[index].fileName = import_path2.default.basename(resolved);
    db.localFiles[index].size = stat.size;
    db.localFiles[index].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const fileType = db.localFiles[index].fileType;
    const lId = db.localFiles[index].lectureId;
    const lecIndex = db.lectures.findIndex((l) => l.id === lId);
    if (lecIndex !== -1) {
      if (fileType === "video") {
        db.lectures[lecIndex].videoUrl = resolved;
        db.lectures[lecIndex].videoProvider = "local";
      } else {
        db.lectures[lecIndex].fileUrl = resolved;
        db.lectures[lecIndex].fileName = import_path2.default.basename(resolved);
      }
    }
    writeDB(db);
    res.json({ success: true, file: db.localFiles[index] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/local-media/stream", (req, res) => {
  const lectureId = req.query.lectureId;
  const token = req.query.token;
  if (!lectureId || !token) {
    return res.status(401).send("Unauthorized: Missing parameters");
  }
  res.redirect(`/api/video/stream?id=${lectureId}&token=${token}`);
});
app.get("/api/local-media/view", (req, res) => {
  const lectureId = req.query.lectureId;
  const token = req.query.token;
  if (!lectureId || !token) {
    return res.status(401).send("Unauthorized");
  }
  const verified = verifyMediaToken(token, "download");
  if (!verified || verified.lectureId !== lectureId) {
    return res.status(403).send("Forbidden");
  }
  try {
    const db = readDB();
    const lecture = db.lectures.find((l) => l.id === lectureId);
    if (!lecture || !lecture.fileUrl) return res.status(404).send("File not found");
    let filePath = lecture.fileUrl;
    if (!import_path2.default.isAbsolute(filePath)) {
      filePath = import_path2.default.join(process.cwd(), filePath.startsWith("/") ? filePath.substring(1) : filePath);
    }
    if (!import_fs2.default.existsSync(filePath) || !isPathAllowed(filePath)) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [STORAGE_DIR];
      const found = smartSearchFile(folders, lecture.fileName || import_path2.default.basename(filePath));
      if (found && isPathAllowed(found)) {
        filePath = found;
      } else {
        return res.status(404).send("File not found");
      }
    }
    const utf8Filename = encodeURIComponent(lecture.fileName || import_path2.default.basename(filePath));
    res.setHeader("Content-Type", getContentType(filePath));
    res.setHeader("Content-Disposition", `inline; filename="${import_path2.default.basename(filePath)}"; filename*=UTF-8''${utf8Filename}`);
    import_fs2.default.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).send("Error reading file: " + err.message);
  }
});
app.get("/api/media/stream/:lectureId", (req, res) => {
  const { lectureId } = req.params;
  const token = req.query.token || req.headers.authorization?.split(" ")[1];
  let userUid = null;
  if (token) {
    const verified = verifyMediaToken(token, "stream");
    if (verified && verified.lectureId === lectureId) {
      userUid = verified.uid;
    } else {
      userUid = verifyToken(token);
    }
  }
  if (!userUid) {
    const authUser = getAuthUser(req);
    if (authUser) userUid = authUser.uid;
  }
  try {
    const db = readDB();
    const lecture = db.lectures.find((l) => l.id === lectureId);
    if (!lecture) return res.status(404).json({ error: "Lecture not found" });
    if (lecture.tierRequired && lecture.tierRequired !== "free") {
      if (!userUid) {
        return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u062A\u0648\u0641\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0644\u0628\u062B." });
      }
      const user = db.users.find((u) => u.uid === userUid);
      const access = checkLectureAccess(user || null, lecture);
      if (!access.hasAccess) {
        return res.status(403).json({ error: access.error || "\u0645\u0631\u0641\u0648\u0636" });
      }
    }
    let videoPath = lecture.videoUrl;
    if (!import_path2.default.isAbsolute(videoPath)) {
      videoPath = import_path2.default.join(process.cwd(), videoPath.startsWith("/") ? videoPath.substring(1) : videoPath);
    }
    if (!import_fs2.default.existsSync(videoPath) || !isPathAllowed(videoPath)) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [STORAGE_DIR];
      const found = smartSearchFile(folders, lecture.videoFileName || import_path2.default.basename(videoPath), lecture.videoSize);
      if (found && isPathAllowed(found)) {
        videoPath = found;
      } else {
        return res.status(404).json({ error: "File not found" });
      }
    }
    streamMedia(req, res, videoPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/media/attachment/:lectureId", (req, res) => {
  const { lectureId } = req.params;
  const token = req.query.token || req.headers.authorization?.split(" ")[1];
  let userUid = null;
  if (token) {
    const verified = verifyMediaToken(token, "download");
    if (verified && verified.lectureId === lectureId) {
      userUid = verified.uid;
    } else {
      userUid = verifyToken(token);
    }
  }
  if (!userUid) {
    const authUser = getAuthUser(req);
    if (authUser) userUid = authUser.uid;
  }
  try {
    const db = readDB();
    const lecture = db.lectures.find((l) => l.id === lectureId);
    if (!lecture || !lecture.fileUrl) return res.status(404).json({ error: "Attachment not found" });
    if (lecture.tierRequired && lecture.tierRequired !== "free") {
      if (!userUid) {
        return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641." });
      }
      const user = db.users.find((u) => u.uid === userUid);
      const access = checkLectureAccess(user || null, lecture);
      if (!access.hasAccess) {
        return res.status(403).json({ error: access.error || "\u0645\u0631\u0641\u0648\u0636" });
      }
    }
    let filePath = lecture.fileUrl;
    if (!import_path2.default.isAbsolute(filePath)) {
      filePath = import_path2.default.join(process.cwd(), filePath.startsWith("/") ? filePath.substring(1) : filePath);
    }
    if (!import_fs2.default.existsSync(filePath) || !isPathAllowed(filePath)) {
      const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [STORAGE_DIR];
      const found = smartSearchFile(folders, lecture.fileName || import_path2.default.basename(filePath));
      if (found && isPathAllowed(found)) {
        filePath = found;
      } else {
        return res.status(404).json({ error: "Attachment file not found" });
      }
    }
    const utf8Filename = encodeURIComponent(lecture.fileName || import_path2.default.basename(filePath));
    res.setHeader("Content-Disposition", `attachment; filename="${import_path2.default.basename(filePath)}"; filename*=UTF-8''${utf8Filename}`);
    streamMedia(req, res, filePath);
  } catch (err) {
    res.status(550).json({ error: err.message });
  }
});
app.get("/api/admin/media-audit", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
  try {
    const db = readDB();
    const results = db.lectures.map((lecture) => {
      if (lecture.videoProvider !== "local") return { id: lecture.id, title: lecture.title, status: "external" };
      const videoPath = lecture.videoUrl.startsWith("/") ? import_path2.default.join(process.cwd(), lecture.videoUrl.substring(1)) : import_path2.default.normalize(lecture.videoUrl);
      let exists = import_fs2.default.existsSync(videoPath) && import_fs2.default.statSync(videoPath).isFile();
      let readable = false;
      let autoHealed = false;
      let newPath = "";
      if (!exists && lecture.videoFileName) {
        const folders = db.settings.mediaFolders && db.settings.mediaFolders.length > 0 ? db.settings.mediaFolders : [STORAGE_DIR];
        let foundPath = smartSearchFile(folders, lecture.videoFileName, lecture.videoSize);
        if (foundPath && isPathAllowed(foundPath)) {
          const relativePath = import_path2.default.relative(process.cwd(), foundPath).replace(/\\/g, "/");
          newPath = `/${relativePath}`;
          autoHealed = true;
          exists = true;
          db.lectures[db.lectures.findIndex((l) => l.id === lecture.id)].videoUrl = newPath;
          db.lectures[db.lectures.findIndex((l) => l.id === lecture.id)].lastKnownPath = foundPath;
          writeDB(db);
        }
      }
      if (exists) {
        try {
          const checkPath = autoHealed ? import_path2.default.join(process.cwd(), newPath.substring(1)) : videoPath;
          import_fs2.default.accessSync(checkPath, import_fs2.default.constants.R_OK);
          readable = true;
        } catch (e) {
        }
      }
      let stats = null;
      try {
        const checkPath = autoHealed ? import_path2.default.join(process.cwd(), newPath.substring(1)) : videoPath;
        stats = import_fs2.default.statSync(checkPath);
      } catch (e) {
      }
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
        status: exists ? readable ? "ok" : "locked" : "missing",
        size: stats?.size,
        extension: stats ? import_path2.default.extname(lecture.videoUrl) : void 0
      };
    });
    res.json({ success: true, data: { audit: results } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/admin/users", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const db = readDB();
    res.json({ success: true, data: { users: db.users || [] } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.put("/api/admin/users/:userId/subscription", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  const { subscription, subscriptionStatus, pendingSubscriptionType, paymentTxInfo } = req.body;
  try {
    const db = readDB();
    const userIndex = db.users.findIndex((u) => u.uid === req.params.userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } });
    }
    const targetUser = db.users[userIndex];
    let activationDate = targetUser.subscriptionActivatedAt || "";
    let expiryDate = targetUser.subscriptionExpiresAt || "";
    let maxDl = targetUser.maxDownloads || 10;
    if (subscriptionStatus === "active") {
      const now = /* @__PURE__ */ new Date();
      const expires = /* @__PURE__ */ new Date();
      if (subscription === "gold") {
        expires.setDate(expires.getDate() + 31);
        maxDl = -1;
      } else {
        expires.setDate(expires.getDate() + 15);
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
      pendingSubscriptionType: pendingSubscriptionType !== void 0 ? pendingSubscriptionType : targetUser.pendingSubscriptionType,
      paymentTxInfo: paymentTxInfo !== void 0 ? paymentTxInfo : targetUser.paymentTxInfo,
      subscriptionActivatedAt: activationDate,
      subscriptionExpiresAt: expiryDate,
      maxDownloads: maxDl
    };
    writeDB(db);
    res.json({ success: true, profile: db.users[userIndex], data: { profile: db.users[userIndex] } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.put("/api/admin/users/:userId/quota", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  const { maxDownloads, resetCounter } = req.body;
  try {
    const db = readDB();
    const userIndex = db.users.findIndex((u) => u.uid === req.params.userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" } });
    }
    if (maxDownloads !== void 0) db.users[userIndex].maxDownloads = maxDownloads;
    if (resetCounter) db.users[userIndex].downloadCounter = 0;
    writeDB(db);
    res.json({ success: true, profile: db.users[userIndex] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/lectures/:id/download-track", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  }
  try {
    const db = readDB();
    const userIndex = db.users.findIndex((u) => u.uid === authUser.uid);
    if (userIndex === -1) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    }
    const user = db.users[userIndex];
    const lecture = db.lectures.find((l) => l.id === req.params.id);
    if (!lecture) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u062D\u0627\u0636\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    }
    if (user.role === "admin" || user.subscription === "gold") {
      return res.json({ success: true, unlimited: true });
    }
    const currentCounter = user.downloadCounter || 0;
    const maxDl = user.maxDownloads || 10;
    if (maxDl !== -1 && currentCounter >= maxDl) {
      return res.status(403).json({
        error: "quota_exceeded",
        message: "\u0644\u0642\u062F \u0627\u0633\u062A\u0647\u0644\u0643\u062A \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u062D\u0645\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0639\u0636\u0648\u064A\u062A\u0643 \u0627\u0644\u0628\u0631\u0648\u0646\u0632\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0631\u0642\u064A\u0629 \u0644\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0630\u0647\u0628\u064A \u0644\u0644\u062A\u062D\u0645\u064A\u0644 \u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u0648\u062F"
      });
    }
    db.users[userIndex].downloadCounter = currentCounter + 1;
    writeDB(db);
    res.json({ success: true, counter: db.users[userIndex].downloadCounter });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/backup/create", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const fileName = await createBackup();
    res.json({ success: true, data: { fileName } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/admin/backup/restore", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621" } });
  }
  try {
    const { fileName } = req.body;
    restoreBackup(fileName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
app.post("/api/system/upload", (req, res, next) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ success: false, error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0627\u0621 \u0628\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A" });
  }
  next();
}, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0644\u0641 \u062A\u0645 \u0631\u0641\u0639\u0647" });
  }
  try {
    const relativePath = import_path2.default.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;
    let originalName = req.file.originalname;
    try {
      originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    } catch (e) {
    }
    res.json({
      success: true,
      path: fileUrl,
      filename: req.file.filename,
      originalName,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641: " + err.message });
  }
});
if (process.env.NODE_ENV === "production") {
  const distPath = import_path2.default.join(process.cwd(), "dist");
  if (import_fs2.default.existsSync(distPath)) {
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
}
app.use(errorHandler);
var app_default = app;

// server/config/vite.ts
var import_vite = require("vite");
async function getViteMiddleware() {
  const vite = await (0, import_vite.createServer)({
    server: { middlewareMode: true },
    appType: "spa"
  });
  return vite;
}

// server/index.ts
var import_path3 = __toESM(require("path"), 1);
var import_express2 = __toESM(require("express"), 1);
async function startServer() {
  if (env.NODE_ENV !== "production") {
    const vite = await getViteMiddleware();
    app_default.use((req, res, next) => {
      if (req.url.startsWith("/api/")) {
        next();
      } else {
        vite.middlewares(req, res, next);
      }
    });
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app_default.use(import_express2.default.static(distPath));
    app_default.get("*", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app_default.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
