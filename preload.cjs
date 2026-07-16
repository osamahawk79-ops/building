// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => import_electron.ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    import_electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
  }
});
//# sourceMappingURL=preload.cjs.map
