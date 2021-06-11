import isElectron from 'is-electron';
import { electronApi } from './electronApi';

export async function getOSMicPermissionGranted() {
  if (!isElectron()) {
    return true;
  }
  if (electronApi().platform === 'darwin') {
    const mediaAccessResult = new Promise((resolve, reject) => {
      electronApi().send('ask-for-media-access', 'microphone');
      electronApi().once('ask-for-media-access-response', (result) => {
        resolve(result);
      });
    });
    return await mediaAccessResult;
  } else {
    return true;
  }
}
