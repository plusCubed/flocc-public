import React, { useMemo } from 'react';

import { Transition, Popover } from '@headlessui/react';
import isElectron from 'is-electron';
import { useRecoilState } from 'recoil';

import { audioInputAtom, audioOutputAtom } from '../atoms/audioDeviceAtom';
import { electronApi } from '../util/electronApi';

import { AudioSelector } from './audioSelector';
import { MicrophoneIcon, SettingsIcon, SpeakerIcon } from './icons';
import { Button } from './ui';

export function SettingsDropdown({ signOut }) {
  const [inputDevice, setInputDevice] = useRecoilState(audioInputAtom);
  const [outputDevice, setOutputDevice] = useRecoilState(audioOutputAtom);

  const version = useMemo(() => {
    return isElectron() ? electronApi().sendSync('version') : null;
  }, []);

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Popover.Overlay className="bg-overlay fixed inset-0" />
          </Transition>
          <Popover.Button
            className={
              'relative focus:outline-none rounded text-gray-700 ml-1 p-1 ' +
              (open ? 'bg-gray-400' : 'hover:bg-gray-200')
            }
          >
            <SettingsIcon className="z-10" width={20} height={20} />
          </Popover.Button>
          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Popover.Panel className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg outline-none p-2">
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
                {isElectron() ? <div>v{version}</div> : null}
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
