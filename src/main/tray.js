const { app, Tray, Menu } = require('electron');
const path = require('path');

class TrayGenerator {
  constructor(mainWindow) {
    this.tray = null;
    this.mainWindow = mainWindow;
  }

  showWindow() {
    this.mainWindow.show();
    this.mainWindow.setVisibleOnAllWorkspaces(true);
    this.mainWindow.focus();
    this.mainWindow.setVisibleOnAllWorkspaces(false);
  }

  toggleWindow() {
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
      if(app.dock)
        app.dock.hide();
    } else {
      this.showWindow();
      if(app.dock)
        app.dock.show();
    }
  }

  rightClickMenu() {
    const menu = Menu.buildFromTemplate([
      {
        role: 'quit',
      },
    ]);
    this.tray.popUpContextMenu(menu);
  }

  createTray() {
    const iconPath =
      process.platform === 'win32' ? 'icon.png' : 'mac_tray_icon.png';
    this.tray = new Tray(path.join(__dirname, '..', '..', 'assets', iconPath));
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', () => this.toggleWindow());
    this.tray.on('right-click', () => this.rightClickMenu());
  }
}

module.exports = TrayGenerator;
