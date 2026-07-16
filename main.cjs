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

// electron/main.ts
var import_electron2 = require("electron");
var import_path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_axios = __toESM(require("axios"), 1);

// electron/ipc/handlers.ts
var import_electron = require("electron");
function setupIpcHandlers() {
  import_electron.ipcMain.on("ping", (event) => {
    event.reply("pong");
  });
}

// electron/main.ts
var import_electron_updater = require("electron-updater");
var mainWindow = null;
var serverProcess = null;
var SERVER_PORT = process.env.PORT || 3e3;
var SERVER_URL = `http://localhost:${SERVER_PORT}`;
import_electron_updater.autoUpdater.autoDownload = false;
import_electron_updater.autoUpdater.on("update-available", () => {
  mainWindow?.webContents.send("update-available");
});
import_electron_updater.autoUpdater.on("update-downloaded", () => {
  import_electron_updater.autoUpdater.quitAndInstall();
});
import_electron2.ipcMain.on("check-for-updates", () => {
  import_electron_updater.autoUpdater.checkForUpdates();
});
import_electron2.ipcMain.on("download-update", () => {
  import_electron_updater.autoUpdater.downloadUpdate();
});
async function startServer() {
  const serverPath = import_path.default.join(__dirname, "../dist/server.cjs");
  serverProcess = (0, import_child_process.spawn)(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(SERVER_PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverProcess.stdout?.on("data", (data) => console.log("[server]", data.toString()));
  serverProcess.stderr?.on("data", (data) => console.error("[server err]", data.toString()));
  serverProcess.on("exit", (code) => {
    if (code !== 0 && mainWindow) {
      import_electron2.dialog.showErrorBox("Server Error", `Backend exited with code ${code}.`);
    }
  });
  for (let i = 0; i < 20; i++) {
    try {
      await import_axios.default.get(`${SERVER_URL}/api/health`);
      console.log("[electron] Backend server is up \u2705");
      return;
    } catch {
      console.log(`[electron] Waiting for server... attempt ${i + 1}/20`);
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  throw new Error("Backend server failed to start after 20 seconds.");
}
function createWindow() {
  const iconPath = import_path.default.join(__dirname, "../assets/icon.png");
  mainWindow = new import_electron2.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    // show only after ready-to-show
    icon: iconPath,
    title: "LMS Platform \u2014 Building Makers",
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });
  mainWindow.loadURL(SERVER_URL);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) return { action: "allow" };
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron2.app.on("ready", async () => {
  try {
    await startServer();
    createWindow();
    setupIpcHandlers();
  } catch (err) {
    import_electron2.dialog.showErrorBox("Startup Error", err.message || "Unknown error");
    import_electron2.app.quit();
  }
});
import_electron2.app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  if (process.platform !== "darwin") import_electron2.app.quit();
});
import_electron2.app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
//# sourceMappingURL=main.cjs.map
