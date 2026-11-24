// SPDX-License-Identifier: Apache-2.0
import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
} from "electron";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const scheme = "open-spritesheet";
const host = "local";
const startUrl = `${scheme}://${host}/`;
const webRoot = resolve(app.getAppPath(), "web");
const preloadPath = resolve(app.getAppPath(), "preload.cjs");
const ELECTRON_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

function isWithinRoot(rootDir: string, targetPath: string): boolean {
  const rel = relative(rootDir, targetPath);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function isAppUrl(value: string): boolean {
  const url = URL.parse(value);
  return url?.protocol === `${scheme}:` && url.host === host;
}

function openWebsite(value: string): void {
  if (URL.parse(value)?.protocol === "https:") {
    void shell.openExternal(value).catch(console.error);
  }
}

function isAppLoaded(window?: BrowserWindow | null): boolean {
  const win = window ?? BrowserWindow.getFocusedWindow();
  if (!win || win.webContents.isLoading()) return false;
  return isAppUrl(win.webContents.getURL());
}

function sendMenuAction(action: string): void {
  const window = BrowserWindow.getFocusedWindow();
  if (!isAppLoaded(window)) return;
  window!.webContents.send("menu-action", action);
}

const windowCanExport = new WeakMap<BrowserWindow, boolean>();

function updateMenuState(): void {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const focused = BrowserWindow.getFocusedWindow();
  const hasApp = isAppLoaded(focused);
  const canExport =
    hasApp && Boolean(focused && windowCanExport.get(focused) === true);
  const dependentIds = [
    "menu-export",
    "menu-find",
    "menu-copy-json",
    "menu-import-json",
    "menu-toggle-sidebar",
    "menu-advanced-tools",
    "menu-character-credits",
  ];
  for (const id of dependentIds) {
    const item = menu.getMenuItemById(id);
    if (item) {
      item.enabled = id === "menu-export" ? canExport : hasApp;
    }
  }
}

function openWindow(): void {
  const window = new BrowserWindow({
    title: "Open Spritesheet",
    width: 1440,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openWebsite(url);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openWebsite(url);
    return { action: "deny" };
  });

  window.webContents.on("did-start-loading", () => {
    windowCanExport.set(window, false);
    updateMenuState();
  });
  window.webContents.on("did-finish-load", () => {
    updateMenuState();
  });
  window.on("focus", () => {
    updateMenuState();
  });
  window.on("blur", () => {
    updateMenuState();
  });
  window.on("closed", () => {
    updateMenuState();
  });

  void window.loadURL(startUrl);
}

function allowClipboard(permission: string): boolean {
  return (
    permission === "clipboard-read" ||
    permission === "clipboard-sanitized-write"
  );
}

void app
  .whenReady()
  .then(async () => {
    const realWebRoot = await realpath(webRoot).catch(() => webRoot);

    protocol.handle(scheme, async (request) => {
      if (!isAppUrl(request.url)) return new Response(null, { status: 403 });
      const url = new URL(request.url);
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405 });
      }
      let path: string;
      try {
        path = decodeURIComponent(url.pathname);
      } catch {
        return new Response(null, { status: 400 });
      }
      if (path.includes("\0")) return new Response(null, { status: 400 });
      const file = resolve(webRoot, path === "/" ? "index.html" : `.${path}`);
      if (!isWithinRoot(webRoot, file)) {
        return new Response(null, { status: 403 });
      }
      let realFile: string;
      try {
        realFile = await realpath(file);
      } catch {
        return new Response(null, { status: 404 });
      }
      if (!isWithinRoot(realWebRoot, realFile)) {
        return new Response(null, { status: 403 });
      }
      try {
        const info = await stat(realFile);
        if (!info.isFile()) {
          return new Response(null, { status: 404 });
        }
      } catch {
        return new Response(null, { status: 404 });
      }
      try {
        const upstream = await net.fetch(pathToFileURL(realFile).href, {
          method: request.method,
        });
        const headers = new Headers(upstream.headers);
        headers.set("Content-Security-Policy", ELECTRON_CSP);
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        });
      } catch (error) {
        console.error("Failed to serve local asset:", error);
        return new Response(null, { status: 500 });
      }
    });

    session.defaultSession.setPermissionCheckHandler(
      (_, permission, origin) => isAppUrl(origin) && allowClipboard(permission),
    );
    session.defaultSession.setPermissionRequestHandler(
      (_, permission, decide, details) =>
        decide(
          details.isMainFrame &&
            isAppUrl(details.requestingUrl) &&
            allowClipboard(permission),
        ),
    );

    ipcMain.handle("clipboard:write-text", (event, text: unknown) => {
      if (typeof text !== "string") return false;
      if (!event.senderFrame || event.senderFrame.parent !== null) return false;
      if (!isAppUrl(event.senderFrame.url)) return false;
      clipboard.writeText(text);
      return true;
    });

    ipcMain.handle("clipboard:read-text", (event) => {
      if (!event.senderFrame || event.senderFrame.parent !== null) return "";
      if (!isAppUrl(event.senderFrame.url)) return "";
      return clipboard.readText();
    });

    ipcMain.on("export-state:update", (event, canExport: unknown) => {
      if (typeof canExport !== "boolean") return;
      if (!event.senderFrame || event.senderFrame.parent !== null) return;
      if (!isAppUrl(event.senderFrame.url)) return;
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        windowCanExport.set(win, canExport);
      }
      updateMenuState();
    });

    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: "appMenu" },
        {
          label: "File",
          submenu: [
            {
              id: "menu-export",
              label: "Export…",
              accelerator: "CmdOrCtrl+E",
              click: () => sendMenuAction("export"),
            },
            { type: "separator" },
            { role: "close" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
            { type: "separator" },
            {
              id: "menu-find",
              label: "Find…",
              accelerator: "CmdOrCtrl+F",
              click: () => sendMenuAction("find"),
            },
            { type: "separator" },
            {
              id: "menu-copy-json",
              label: "Copy Character JSON",
              accelerator: "CmdOrCtrl+Shift+C",
              click: () => sendMenuAction("copy-json"),
            },
            {
              id: "menu-import-json",
              label: "Import Character JSON…",
              accelerator: "CmdOrCtrl+Shift+V",
              click: () => sendMenuAction("import-json"),
            },
          ],
        },
        {
          label: "View",
          submenu: [
            {
              id: "menu-toggle-sidebar",
              label: "Toggle Categories Sidebar",
              accelerator: "CmdOrCtrl+B",
              click: () => sendMenuAction("toggle-sidebar"),
            },
            { type: "separator" },
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
        {
          label: "History",
          submenu: [
            {
              label: "Back",
              accelerator: "CmdOrCtrl+[",
              click: () => {
                const history =
                  BrowserWindow.getFocusedWindow()?.webContents
                    .navigationHistory;
                if (history?.canGoBack()) history.goBack();
              },
            },
            {
              label: "Forward",
              accelerator: "CmdOrCtrl+]",
              click: () => {
                const history =
                  BrowserWindow.getFocusedWindow()?.webContents
                    .navigationHistory;
                if (history?.canGoForward()) history.goForward();
              },
            },
          ],
        },
        {
          label: "Tools",
          submenu: [
            {
              id: "menu-advanced-tools",
              label: "Advanced Tools…",
              accelerator: "CmdOrCtrl+Shift+A",
              click: () => sendMenuAction("advanced-tools"),
            },
          ],
        },
        { role: "windowMenu" },
        {
          role: "help",
          submenu: [
            {
              id: "menu-character-credits",
              label: "Character Credits…",
              click: () => sendMenuAction("character-credits"),
            },
            {
              label: "All Artwork Credits",
              click: () => {
                void shell
                  .openPath(resolve(app.getAppPath(), "CREDITS.csv"))
                  .then((errorMessage) => {
                    if (errorMessage) {
                      console.error(
                        "Failed to open CREDITS.csv:",
                        errorMessage,
                      );
                    }
                  });
              },
            },
            { type: "separator" },
            {
              label: "Source on GitHub",
              click: () =>
                openWebsite("https://github.com/teakay1311/OpenSpritesheet"),
            },
            {
              label: "Universal LPC Spritesheet Character Generator",
              click: () =>
                openWebsite(
                  "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator",
                ),
            },
          ],
        },
      ]),
    );
    openWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) openWindow();
    });
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
