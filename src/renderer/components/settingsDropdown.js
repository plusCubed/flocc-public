import React, { useCallback, useState } from 'react';
import { Transition } from '@headlessui/react';
import { Button } from './ui';
import { AudioSelector } from './audioSelector';
import isElectron from 'is-electron';
import { MicrophoneIcon, SettingsIcon, SpeakerIcon } from './icons';

export function SettingsDropdown({
  signOut,
  inputDevice,
  outputDevice,
  setInputDevice,
  setOutputDevice,
}) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((open) => !open);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <div className="relative">
      <Transition
        show={open}
        enter="transition duration-100 ease-out"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          className="fixed bg-overlay left-0 top-0 w-screen h-screen z-0"
          onClick={close}
        />
      </Transition>
      <button
        className={
          'relative focus:outline-none rounded text-gray-700 ml-1 p-1 ' +
          (open ? 'bg-gray-400' : 'hover:bg-gray-200')
        }
        onClick={toggle}
      >
        <SettingsIcon className="z-10" width={20} height={20} />
      </button>
      <Transition
        show={open}
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg outline-none p-2">
          <AudioSelector
            kind="audioinput"
            icon={<MicrophoneIcon className="w-4 h-4 mr-1" />}
            device={inputDevice}
            onDeviceChange={setInputDevice}
          />
          <AudioSelector
            kind="audiooutput"
            icon={<SpeakerIcon className="w-4 h-4 mr-1" />}
            device={outputDevice}
            onDeviceChange={setOutputDevice}
          />
          <div className="flex flex-row align-baseline  mt-1">
            <Button onClick={signOut} className="text-sm">
              Sign out
            </Button>
            <div className="flex-1" />
            {isElectron() ? (
              <div>v{require('electron').remote.app.getVersion()}</div>
            ) : null}
          </div>
        </div>
      </Transition>
    </div>
  );
}
