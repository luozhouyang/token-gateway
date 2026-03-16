import { contextBridge, ipcRenderer } from "electron";

// 暴露安全的 IPC 通道给渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 代理控制
  startProxy: (configPath: string) => ipcRenderer.invoke("proxy:start", configPath),
  stopProxy: () => ipcRenderer.invoke("proxy:stop"),
  restartProxy: () => ipcRenderer.invoke("proxy:restart"),

  // 状态查询
  getProxyStatus: () => ipcRenderer.invoke("proxy:status"),

  // 配置管理
  loadConfig: (path: string) => ipcRenderer.invoke("config:load", path),
  saveConfig: (path: string, config: object) => ipcRenderer.invoke("config:save", path, config),

  // 事件订阅
  onProxyStatusChange: (callback: (status: any) => void) => {
    ipcRenderer.on("proxy:status-change", (_, status) => callback(status));
  },
  onProxyLog: (callback: (log: any) => void) => {
    ipcRenderer.on("proxy:log", (_, log) => callback(log));
  },
});

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      startProxy: (configPath: string) => Promise<any>;
      stopProxy: () => Promise<any>;
      restartProxy: () => Promise<any>;
      getProxyStatus: () => Promise<any>;
      loadConfig: (path: string) => Promise<any>;
      saveConfig: (path: string, config: object) => Promise<any>;
      onProxyStatusChange: (callback: (status: any) => void) => void;
      onProxyLog: (callback: (log: any) => void) => void;
    };
  }
}
