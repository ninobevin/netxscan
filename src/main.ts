import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { closeDatabase } from './db/client';
import { registerIpcHandlers } from './ipc/register-handlers';

if (started) {
  app.quit();
}

nativeTheme.themeSource = 'light';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    title: 'NetXScan',
    backgroundColor: '#f4fafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
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
  void registerIpcHandlers().finally(() => {
    createWindow();
  });
});

app.on('window-all-closed', () => {
  void closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
