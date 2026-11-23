// SPDX-License-Identifier: Apache-2.0
import { contextBridge, ipcRenderer } from "electron";

const VALID_MENU_ACTIONS = new Set([
  "export",
  "find",
  "toggle-sidebar",
  "advanced-tools",
  "character-credits",
  "copy-json",
  "import-json",
]);

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  onMenuAction(callback: (action: string) => void): () => void {
    if (typeof callback !== "function") return () => {};
    const listener = (_event: Electron.IpcRendererEvent, action: unknown) => {
      if (typeof action === "string" && VALID_MENU_ACTIONS.has(action)) {
        callback(action);
      }
    };
    ipcRenderer.on("menu-action", listener);
    return () => {
      ipcRenderer.removeListener("menu-action", listener);
    };
  },
  async writeClipboardText(text: string): Promise<void> {
    if (typeof text !== "string") return;
    const ok = await ipcRenderer.invoke("clipboard:write-text", text);
    if (ok !== true) {
      throw new Error("Failed to write text to clipboard");
    }
  },
  async readClipboardText(): Promise<string> {
    const text = await ipcRenderer.invoke("clipboard:read-text");
    return typeof text === "string" ? text : "";
  },
  updateExportState(canExport: boolean): void {
    if (typeof canExport === "boolean") {
      ipcRenderer.send("export-state:update", canExport);
    }
  },
});
