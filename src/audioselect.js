import React, { Suspense, useCallback, useState } from 'react';
import usePromise from 'react-promise-suspense';
import { Option, Select } from './components';

async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === type);
}

function AudioSelect({ kind, onDeviceChange }) {
  const devices = usePromise(getConnectedDevices, [kind]);
  const [selected, setSelected] = useState(devices[0].deviceId);
  const handleSelectChange = useCallback(
    (event) => {
      setSelected(event.target.value);
      onDeviceChange(event.target.value);
    },
    [onDeviceChange]
  );
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
    <div className="flex flex-row overflow-x-hidden px-1 pb-1 items-center">
      {icon}
      <div className="flex-1">
        <Suspense fallback={<span>Loading...</span>}>
          <AudioSelect kind={kind} onDeviceChange={onDeviceChange} />
        </Suspense>
      </div>
    </div>
  );
}
