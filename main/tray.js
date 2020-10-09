const { Tray, Menu } = require('electron');
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
    } else {
      this.showWindow();
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
    this.tray = new Tray(path.join(__dirname, './assets/icon.png'));
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', () => this.toggleWindow());
    this.tray.on('right-click', () => this.rightClickMenu());
  }
}

module.exports = TrayGenerator;
