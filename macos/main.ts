// SPDX-License-Identifier: Apache-2.0
import {
  app,
  BrowserWindow,
  Menu,
  net,
  protocol,
  session,
  shell,
} from "electron";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const scheme = "open-spritesheet";
const host = "local";
const startUrl = `${scheme}://${host}/`;
const webRoot = resolve(app.getAppPath(), "web");

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

function openWindow(): void {
  const window = new BrowserWindow({
    title: "Open Spritesheet",
    width: 1440,
    height: 900,
    webPreferences: {
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
  .then(() => {
    protocol.handle(scheme, (request) => {
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
      const fromWebRoot = relative(webRoot, file);
      if (
        fromWebRoot === ".." ||
        fromWebRoot.startsWith(`..${sep}`) ||
        isAbsolute(fromWebRoot)
      ) {
        return new Response(null, { status: 403 });
      }
      return net.fetch(pathToFileURL(file).href, { method: request.method });
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

    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: "appMenu" },
        { role: "editMenu" },
        { role: "viewMenu" },
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
        { role: "windowMenu" },
        {
          role: "help",
          submenu: [
            {
              label: "Artwork Credits",
              click: () => {
                void shell.openPath(resolve(app.getAppPath(), "CREDITS.csv"));
              },
            },
            {
              label: "Source on GitHub",
              click: () =>
                openWebsite("https://github.com/teakay1311/OpenSpritesheet"),
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
