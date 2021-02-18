import React, { Suspense, useCallback, useEffect, useState } from 'react';
import usePromise from 'react-promise-suspense';

import { Option, Select } from './ui';
import { getOSMicPermissionGranted } from '../util/micPermission';

async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === type);
}

export function useOSMicPermissionGranted() {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    async function updateGranted() {
      setGranted(await getOSMicPermissionGranted());
    }
    updateGranted();
  }, []);
  return granted;
}

function AudioSelect({ kind, device, onDeviceChange }) {
  const micGranted = useOSMicPermissionGranted();
  const devices = usePromise(getConnectedDevices, [kind]);
  const handleSelectChange = useCallback(
    (event) => {
      onDeviceChange(event.target.value);
    },
    [onDeviceChange]
  );
  return micGranted || kind !== 'audioinput' ? (
    <Select value={device} onChange={handleSelectChange}>
      {devices.map((input) => (
        <Option key={input.deviceId} value={input.deviceId}>
          {input.label}
        </Option>
      ))}
    </Select>
  ) : (
    <div>Mic permission denied</div>
  );
}

export function AudioSelector({ kind, icon, device, onDeviceChange }) {
  return (
    <div className="flex flex-row items-center pb-1">
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
