const { app, Tray, Menu } = require('electron');
const path = require('path');

class TrayGenerator {
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
        label: 'Quit Flocc',
        click: () => {
          app.quit();
        },
      },
      {
        label: 'Open Dev Tools',
        click: () => {
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        },
      },
    ]);
    this.tray.popUpContextMenu(menu);
  }

  createTray() {
    const iconPath =
      process.platform === 'win32' ? 'icon.png' : 'macMenuIconTemplate.png';
    this.tray = new Tray(path.join(__dirname, '..', '..', 'assets', iconPath));
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', () => this.showWindow());
    this.tray.on('right-click', () => this.rightClickMenu());
  }
}

module.exports = TrayGenerator;
