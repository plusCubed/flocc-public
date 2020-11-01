import React, { Suspense, useCallback, useEffect, useState } from 'react';
import usePromise from 'react-promise-suspense';
import isElectron from 'is-electron';

import { Option, Select } from './ui';

async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === type);
}

function AudioSelect({ kind, device, onDeviceChange }) {
  usePromise(async () => {
    if (!isElectron() || require('electron').ipcRenderer.sendSync('is-dev')) {
      return;
    }
    try {
      const { remote } = require('electron');
      if (process.platform === 'darwin' && remote.systemPreferences)
        await remote.systemPreferences.askForMediaAccess('microphone');
    } catch (e) {
      console.error(e);
    }
  }, []);
  const devices = usePromise(getConnectedDevices, [kind]);
  const handleSelectChange = useCallback(
    (event) => {
      onDeviceChange(event.target.value);
    },
    [onDeviceChange]
  );
  return (
    <Select value={device} onChange={handleSelectChange}>
      {devices.map((input) => (
        <Option key={input.deviceId} value={input.deviceId}>
          {input.label}
        </Option>
      ))}
    </Select>
  );
}

export function AudioSelector({ kind, icon, device, onDeviceChange }) {
  return (
    <div className="flex flex-row overflow-x-hidden pb-1 items-center">
      {icon}
      <div className="flex-1">
        <Suspense fallback={<span>Loading...</span>}>
          <AudioSelect
            kind={kind}
            device={device}
            onDeviceChange={onDeviceChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
