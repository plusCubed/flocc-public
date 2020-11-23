import isElectron from 'is-electron';

export async function getOSMicPermissionGranted() {
  /*if (!isElectron() || require('electron').ipcRenderer.sendSync('is-dev')) {
    return true;
  }
  const { remote } = require('electron');
  if (process.platform === 'darwin' && remote.systemPreferences) {
    return await remote.systemPreferences.askForMediaAccess('microphone');
  } else {
    return true;
  }*/
  return false;
}
