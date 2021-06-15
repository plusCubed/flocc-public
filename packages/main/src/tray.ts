import { join } from 'path';
import type { BrowserWindow } from 'electron';
import { app, Tray, Menu } from 'electron';

export class TrayGenerator {
  private mainWindow: BrowserWindow;
  private tray: Tray;

  constructor(mainWindow: BrowserWindow) {
    this.tray = null;
    this.mainWindow = mainWindow;
  }

  hideWindow(): void {
    this.mainWindow.hide();
    if (app.dock) {
      app.dock.hide();
    }
  }

  showWindow(): void {
    if (app.dock) app.dock.show();
    this.mainWindow.show();
    this.mainWindow.setVisibleOnAllWorkspaces(true);
    this.mainWindow.focus();
    this.mainWindow.setVisibleOnAllWorkspaces(false);
  }

  toggleWindow(): void {
    if (this.mainWindow.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  rightClickMenu(): void {
    const openAtLogin = app.getLoginItemSettings().openAtLogin;
    console.log('open at login', openAtLogin);
    const menu = Menu.buildFromTemplate([
      {
        label: 'Check for Updates',
        click: () => {
          import('electron-updater')
            .then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
            .catch((e) => console.error('Failed check updates:', e));
        },
      },
      {
        label: 'Launch on startup',
        type: 'checkbox',
        checked: openAtLogin,
        click: () => {
          const newOpenAtLogin = !openAtLogin;
          app.setLoginItemSettings({
            openAtLogin: newOpenAtLogin,
            openAsHidden: true,
          });
          console.log('set open at login:', newOpenAtLogin);
        },
      },
      {
        label: 'Open Dev Tools',
        click: () => {
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        },
      },
      {
        label: 'Quit Flocc',
        click: () => {
          app.quit();
        },
      },
    ]);
    this.tray.popUpContextMenu(menu);
  }

  createTray(): void {
    const iconPath =
      process.platform === 'win32' ? 'iconTray.png' : 'iconMacTrayTemplate.png';
    this.tray = new Tray(join(__dirname, '..', 'assets', iconPath));
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', () => this.showWindow());
    this.tray.on('right-click', () => this.rightClickMenu());
  }
}
