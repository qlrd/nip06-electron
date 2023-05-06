// src/electron-env.d.ts(need create)
export { }
declare global {
  interface Window {
    // Expose some Api through preload script
    ipcRenderer: import('electron').IpcRenderer
  }
}
