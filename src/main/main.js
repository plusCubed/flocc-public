//import * as Sentry from '@sentry/electron';

const {
  app,
  BrowserWindow,
  autoUpdater,
  dialog,
  ipcMain,
  session,
} = require('electron');
const path = require('path');
const Positioner = require('electron-positioner');
const IS_DEVELOPMENT = require('electron-is-dev');

const TrayGenerator = require('./tray');
const googleOAuthConfig = require('./config/googleOAuthConfig').default;

/*if (!IS_DEVELOPMENT) {
  Sentry.init({
    dsn: 'https://817efb9fe22b4900ad01c6a9cd2a17cf@o604937.ingest.sentry.io/5744711',
  });
}*/

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

if (IS_DEVELOPMENT) {
  app
    .whenReady()
    .then(() => import('electron-devtools-installer'))
    .then(({ default: installExtension, REACT_DEVELOPER_TOOLS }) => {
      return installExtension(REACT_DEVELOPER_TOOLS);
    })
    .catch((e) => console.error('Failed install extension:', e));
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 320,
    height: 640,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: true,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    maximizable: false,
    fullscreenable: false,
    show: false,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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

  const openExternalListener = (e, url) => {
    if (new URL(url).hostname !== 'localhost') {
      e.preventDefault();
      require('electron').shell.openExternal(url);
    }
  };
  mainWindow.webContents.on('will-navigate', openExternalListener);
  mainWindow.webContents.on('new-window', openExternalListener);

  mainWindow.setMenuBarVisibility(false);

  const positioner = new Positioner(mainWindow);
  positioner.move('bottomRight');

  let webpackEntry = MAIN_WINDOW_WEBPACK_ENTRY;

  if (!IS_DEVELOPMENT) {
    // workaround
    session.defaultSession.protocol.interceptFileProtocol(
      'http',
      (request, callback) => {
        const filePath = request.url.replace('http://localhost/', '');
        callback(path.normalize(filePath));
      }
    );
    webpackEntry = webpackEntry.replaceAll('file://', 'http://localhost/');
  }

  // and load the index.html of the app.
  mainWindow.loadURL(webpackEntry);

  // Open the DevTools.
  if (IS_DEVELOPMENT) {
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

  if (!IS_DEVELOPMENT) {
    const nutsServer = 'https://nuts.flocc.app';
    const url = `${nutsServer}/update/${process.platform}/${app.getVersion()}`;
    autoUpdater.setFeedURL({ url });
    autoUpdater.checkForUpdates();
    // every 5 minutes
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 1000 * 60 * 5);
    autoUpdater.on('before-quit-for-update', (e) => {
      isQuiting = true;
    });
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        message: releaseName,
        detail:
          'A new version has been downloaded. Restart to apply the update.',
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

const ElectronGoogleOAuth2 =
  require('@getstation/electron-google-oauth2').default;
const ytsr = require('ytsr');

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

ipcMain.on('is-dev', (event) => {
  event.returnValue = IS_DEVELOPMENT;
});

ipcMain.on('ytsr', async (event, query, options) => {
  try {
    const filters = await ytsr.getFilters(query);
    const filter = filters.get('Type').get('Video');
    const searchResults = await ytsr(filter.url, options);
    event.reply('ytsr-response', null, searchResults);
  } catch (e) {
    event.reply('ytsr-response', e, null);
  }
});
