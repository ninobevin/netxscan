import { app, BrowserWindow, nativeImage, nativeTheme } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { closeDatabase } from './db/client';
import { registerIpcHandlers } from './ipc/register-handlers';

if (started) {
  app.quit();
}

nativeTheme.themeSource = 'light';
app.setAppUserModelId('com.netxscan.app');

function logoFile(name: string): string {
  const packaged = path.join(process.resourcesPath, name);
  const fromCwd = path.join(process.cwd(), 'logo', name);
  const fromDir = path.join(__dirname, '..', '..', 'logo', name);
  if (app.isPackaged && fs.existsSync(packaged)) {
    return packaged;
  }
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  return fromDir;
}

function appIconImage() {
  const png = logoFile('icon.png');
  if (fs.existsSync(png)) {
    return nativeImage.createFromPath(png);
  }
  return nativeImage.createFromPath(logoFile('icon.ico'));
}

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 360,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: true,
    title: 'NetXScan',
    icon: appIconImage(),
    backgroundColor: '#042f2e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void splash.loadFile(logoFile('splash.html'));
  return splash;
}

const createWindow = (splash?: BrowserWindow | null) => {
  const icon = appIconImage();
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'NetXScan',
    icon,
    show: false,
    backgroundColor: '#f4fafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.setIcon(icon);

  mainWindow.once('ready-to-show', () => {
    if (splash && !splash.isDestroyed()) {
      splash.close();
    }
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', () => {
  const splash = createSplash();
  void registerIpcHandlers().finally(() => {
    createWindow(splash);
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
