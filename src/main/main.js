const {
  app,
  BrowserWindow,
  Menu,
  autoUpdater,
  dialog,
  ipcMain,
  shell,
} = require('electron');
const path = require('path');
const Positioner = require('electron-positioner');
const isDevelopment = require('electron-is-dev');
const fetch = require('electron-fetch').default;

const TrayGenerator = require('./tray');
const googleOAuthConfig = require('./config/googleOAuthConfig').default;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

let mainWindow;
let tray;
let isQuiting = false;

app.on('before-quit', () => {
  isQuiting = true;
});

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
    maximizable: false,
    fullscreenable: false,
  });
  /*mainWindow.setMenu(
    Menu.buildFromTemplate([
      {
        role: 'fileMenu',
      },
      {
        role: 'viewMenu',
      },
    ])
  );*/
  mainWindow.on('close', (event) => {
    console.log('close');
    if (!isQuiting) {
      event.preventDefault();
      if (process.platform === 'darwin') {
        mainWindow.hide();
        return;
      }
      tray.hideWindow();
    }
  });
  /*mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });*/

  mainWindow.setMenuBarVisibility(false);

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

async function checkForUpdatesMac(url) {
  const res = await (await fetch(url)).json();
  if (app.getVersion() !== res.name) {
    const dialogOpts = {
      type: 'info',
      buttons: ['Download', 'Later'],
      title: 'Application Update',
      message: res.name,
      detail: 'A new version is available. Download now?',
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        shell.openExternal(res.url);
      }
    });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();

  if (!isDevelopment) {
    const nutsServer = 'https://nuts.flocc.app';
    const url = `${nutsServer}/update/${process.platform}/${app.getVersion()}`;
    if (process.platform === 'darwin') {
      checkForUpdatesMac(url);
      // every hour
      setInterval(() => {
        checkForUpdatesMac(url);
      }, 1000 * 60 * 60);
    } else {
      autoUpdater.setFeedURL({ url });
      autoUpdater.checkForUpdates();
      // every 5 minutes
      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 1000 * 60 * 5);
      autoUpdater.on(
        'update-downloaded',
        (event, releaseNotes, releaseName) => {
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
        }
      );
      autoUpdater.on('error', (e) => {
        console.error('There was a problem updating the application', e);
      });
    }
  }
});

app.on('window-all-closed', () => {
  // override default, do nothing
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  tray.showWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// const ytsr = require('ytsr');
// const ytdl = require('./ytStream');
// ipcMain.on('yt-req', async (event, arg) => {
//   console.log(arg);
//   const url = await ytdl(arg);
//   console.log(url);
//   event.reply('yt-res', url);
// });
const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2')
  .default;
const electronOAuth = new ElectronGoogleOAuth2(
  googleOAuthConfig.clientId,
  googleOAuthConfig.clientSecret,
  [],
  {
    successRedirectURL: 'https://flocc.app/oauth',
  }
);
ipcMain.on('sign-in-with-google', async (event) => {
  try {
    const token = await electronOAuth.openAuthWindowAndGetTokens();
    event.reply('sign-in-with-google-response', null, token);
  } catch (e) {
    event.reply('sign-in-with-google-response', e, null);
  }
});

ipcMain.on('is-dev', async (event) => {
  event.returnValue = isDevelopment;
});
