import React, { useMemo } from 'react';

import { Popover, Transition } from '@headlessui/react';

import { InfoIcon, MicrophoneIcon, SettingsIcon, SpeakerIcon } from './icons';
import { StatusIndicator } from './statusIndicator';
import { Button } from './ui';

export function HelpPopup({ signOut }) {
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
            <InfoIcon className="z-10" width={20} height={20} />
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
            <Popover.Panel className="absolute right-0 bottom-10 w-80 mt-2 origin-bottom-right bg-white border border-gray-200 rounded-md shadow-lg outline-none p-4">
              <div className="font-semibold">How Flocc works</div>

              <ul className="list-disc list-outside ml-4">
                <li>
                  Active status{' '}
                  <StatusIndicator status="ACTIVE" className="mr-1.5" />
                  <span className="italic">means</span> active!
                  <ul className="list-circle list-outside ml-4">
                    <li>Active = the Flocc app is visible</li>
                    <li>Any friends can immediately jump in a VC with you</li>
                    <ul className="list-circle list-outside ml-4">
                      <li>(but you'll start muted)</li>
                    </ul>
                    <li>You can join any active VC a friend is in</li>
                  </ul>
                </li>

                <li>
                  5 minutes after hiding the app, you become idle{' '}
                  <StatusIndicator status="IDLE" className="mr-1.5" />
                </li>
                <li>Try queueing some music! 🎵</li>
              </ul>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
