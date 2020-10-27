import React, { Suspense, useCallback, useEffect, useState } from 'react';
import usePromise from 'react-promise-suspense';
import isElectron from 'is-electron';

import { Option, Select } from './ui';

async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === type);
}

function AudioSelect({ kind, onDeviceChange }) {
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
  const [selected, setSelected] = useState(devices[0].deviceId);
  const handleSelectChange = useCallback((event) => {
    setSelected(event.target.value);
  }, []);
  useEffect(() => {
    onDeviceChange(selected);
  }, [onDeviceChange, selected]);
  return (
    <Select value={selected} onChange={handleSelectChange}>
      {devices.map((input) => (
        <Option key={input.deviceId} value={input.deviceId}>
          {input.label}
        </Option>
      ))}
    </Select>
  );
}

export function AudioSelector({ kind, icon, onDeviceChange }) {
  return (
    <div className="flex flex-row overflow-x-hidden pb-1 items-center">
      {icon}
      <div className="flex-1">
        <Suspense fallback={<span>Loading...</span>}>
          <AudioSelect kind={kind} onDeviceChange={onDeviceChange} />
        </Suspense>
      </div>
    </div>
  );
}
