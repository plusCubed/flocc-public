const {
  app,
  BrowserWindow,
  Menu,
  autoUpdater,
  dialog,
  ipcMain,
} = require('electron');
const path = require('path');
const Positioner = require('electron-positioner');
const isDevelopment = require('electron-is-dev');

const TrayGenerator = require('./tray');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

let mainWindow;
let tray;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 300,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, '../../assets/icon.ico'),
  });
  mainWindow.setMenu(
    Menu.buildFromTemplate([
      {
        role: 'fileMenu',
      },
      {
        role: 'viewMenu',
      },
    ])
  );
  //mainWindow.setMenuBarVisibility(false);

  const positioner = new Positioner(mainWindow);
  positioner.move('bottomRight');

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  if (isDevelopment) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  tray = new TrayGenerator(mainWindow);
  tray.createTray();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();

  if (!isDevelopment) {
    const nutsServer = 'https://nuts.flocc.app';
    const url = `${nutsServer}/update/${process.platform}/${app.getVersion()}`;
    autoUpdater.setFeedURL({ url });
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 300000);
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail:
          'A new version has been downloaded. Restart the application to apply the updates.',
      };

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall();
      });
    });
    autoUpdater.on('error', (e) => {
      console.error('There was a problem updating the application', e);
    });
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const ytsr = require('ytsr');
const ytdl = require('./ytStream');
ipcMain.on('yt-req', async (event, arg) => {
  console.log(arg);
  const url = await ytdl(arg);
  console.log(url);
  event.reply('yt-res', url);
});
