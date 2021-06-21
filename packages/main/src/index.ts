import { join, normalize } from 'path';
import { URL } from 'url';
import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  systemPreferences,
  shell,
  autoUpdater as electronAutoUpdater,
  dialog,
} from 'electron';
import ElectronGoogleOAuth2 from '@getstation/electron-google-oauth2';
import { TrayGenerator } from '/@/tray';
import ytsr from 'ytsr';
import Positioner from 'electron-positioner';
import isFirstRun from 'electron-first-run';
import { autoUpdater } from 'electron-updater';
import { init, captureException } from '@sentry/electron/dist/main';
import googleOAuthConfig from './secrets/googleOAuthConfig';

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

// app.disableHardwareAcceleration();

/**
 * Workaround for TypeScript bug
 * @see https://github.com/microsoft/TypeScript/issues/41468#issuecomment-727543400
 */
const env = import.meta.env;

init({
  dsn: 'https://817efb9fe22b4900ad01c6a9cd2a17cf@o604937.ingest.sentry.io/5744711',
  enabled: env.PROD,
  environment: env.MODE,
});

// Install "React devtools"
if (env.MODE === 'development') {
  app
    .whenReady()
    .then(() => import('electron-devtools-installer'))
    .then(({ default: installExtension, REACT_DEVELOPER_TOOLS }) =>
      installExtension(REACT_DEVELOPER_TOOLS, {
        loadExtensionOptions: {
          allowFileAccess: true,
        },
      })
    )
    .catch((e) => console.error('Failed install extension:', e));
}

if (process.platform === 'win32') {
  app.setAppUserModelId(app.name);
}

let mainWindow: BrowserWindow | null = null;
let tray;
let isQuiting = false;

app.on('before-quit', () => {
  isQuiting = true;
});

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 640,
    show: false, // Use 'ready-to-show' event to show window
    webPreferences: {
      preload: join(__dirname, '../../preload/dist/index.cjs'),
      contextIsolation: env.MODE !== 'test', // Spectron tests can't work with contextIsolation: true
      enableRemoteModule: env.MODE === 'test', // Spectron tests can't work with enableRemoteModule: false
      backgroundThrottling: false,
    },
    maximizable: false,
    fullscreenable: false,
  });

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();

    if (env.MODE === 'development') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('close', (event) => {
    console.log('close');
    if (!isQuiting) {
      event.preventDefault();
      if (process.platform === 'darwin') {
        mainWindow?.hide();
        return;
      }
      tray.hideWindow();
    }
  });
  tray = new TrayGenerator(mainWindow);
  tray.createTray();

  const openExternalListener = (e, url) => {
    if (new URL(url).hostname !== 'localhost') {
      e.preventDefault();
      shell.openExternal(url);
    }
  };
  mainWindow.webContents.on('will-navigate', openExternalListener);
  mainWindow.webContents.on('new-window', openExternalListener);

  mainWindow.setMenuBarVisibility(false);

  const positioner = new Positioner(mainWindow);
  positioner.move('bottomRight');

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test
   */
  let pageUrl =
    env.MODE === 'development'
      ? env.VITE_DEV_SERVER_URL
      : new URL(
          '../renderer/dist/index.html',
          'file://' + __dirname
        ).toString();

  if (env.PROD) {
    // workaround for youtube
    session.defaultSession.protocol.interceptFileProtocol(
      'http',
      (request, callback) => {
        const filePath = request.url.replace('http://localhost/', '');
        callback(normalize(filePath));
      }
    );
    pageUrl = pageUrl.replaceAll('file://', 'http://localhost/');
  }

  await mainWindow.loadURL(pageUrl);
};

app.on('second-instance', () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // do nothing
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  tray.showWindow();
});

app
  .whenReady()
  .then(createWindow)
  .catch((e) => {
    captureException(e);
    console.error('Failed create window:', e);
  });

// Auto-updates
if (env.PROD) {
  app
    .whenReady()
    .then(() => {
      electronAutoUpdater.on('before-quit-for-update', (e) => {
        isQuiting = true;
      });
      autoUpdater.on(
        'update-downloaded',
        (event, releaseNotes, releaseName) => {
          const dialogOpts = {
            type: 'info',
            buttons: ['Restart', 'Later'],
            title: 'Application Update',
            icon: join(__dirname, '..', 'assets', 'icon.png'),
            message: releaseName,
            detail:
              'A new version has been downloaded. Restart to apply the update.',
          };

          dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
              isQuiting = true;
              autoUpdater.quitAndInstall();
            }
          });
        }
      );
      autoUpdater.on('error', (e: Error) => {
        console.error('There was a problem updating the application', e);
        captureException(e);
      });

      function checkUpdate() {
        autoUpdater.checkForUpdates();
        setTimeout(checkUpdate, 1000 * 60 * 5); // every 5 minutes
      }
      checkUpdate();
    })
    .catch((e) => console.error('Failed check updates:', e));
}

if (env.PROD && isFirstRun()) {
  app.whenReady().then(() => {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  });
}

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

ipcMain.on('ytsr', async (event, query, options) => {
  try {
    const filters = await ytsr.getFilters(query);
    const filter = filters.get('Type')?.get('Video');
    const searchResults = await ytsr(filter.url, options);
    event.reply('ytsr-response', null, searchResults);
  } catch (e) {
    captureException(e);
    event.reply('ytsr-response', e, null);
  }
});

ipcMain.on('ask-for-media-access', async (event, mediaType) => {
  try {
    const result = await systemPreferences.askForMediaAccess(mediaType);
    event.reply('ask-for-media-access-response', null, result);
  } catch (e) {
    captureException(e);
    event.reply('ask-for-media-access-response', e, null);
  }
});

ipcMain.on('version', (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.on('flash', (event) => {
  if (process.platform === 'darwin') {
    const bounceId = app.dock.bounce();
    mainWindow.once('focus', () => app.dock.cancelBounce(bounceId));
  } else {
    mainWindow.flashFrame(true);
    setTimeout(() => {
      mainWindow.flashFrame(false);
    }, 2000);
    mainWindow.once('focus', () => mainWindow.flashFrame(false));
  }
  event.returnValue = true;
});
