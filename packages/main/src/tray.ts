import { join } from 'path';
import { app, Tray, Menu } from 'electron';

export class TrayGenerator {
  private mainWindow: any;
  private tray: any;

  constructor(mainWindow) {
    this.tray = null;
    this.mainWindow = mainWindow;
  }

  hideWindow() {
    this.mainWindow.hide();
    if (app.dock) {
      app.dock.hide();
    }
  }

  showWindow() {
    if (app.dock) app.dock.show();
    this.mainWindow.show();
    this.mainWindow.setVisibleOnAllWorkspaces(true);
    this.mainWindow.focus();
    this.mainWindow.setVisibleOnAllWorkspaces(false);
  }

  toggleWindow() {
    if (this.mainWindow.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  rightClickMenu() {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Check for Updates...',
        click: () => {
          import('electron-updater')
            .then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
            .catch((e) => console.error('Failed check updates:', e));
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

  createTray() {
    const iconPath =
      process.platform === 'win32' ? 'iconTray.png' : 'iconMacTray.png';
    this.tray = new Tray(join(__dirname, '..', 'assets', iconPath));
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', () => this.showWindow());
    this.tray.on('right-click', () => this.rightClickMenu());
  }
}
