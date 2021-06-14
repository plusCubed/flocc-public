import React, { useCallback, useState, Suspense, useMemo } from 'react';

import { Transition } from '@headlessui/react';
import { useDatabase } from 'reactfire';

import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { useUid } from '../hooks/useUid';

import { FriendRequests, Friends, PeopleSearch } from './friends';
import { FriendsIcon } from './icons';

export function FriendsDropdown() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((open) => !open);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const uid = useUid();
  const database = useDatabase();
  const friendRequests = useDatabaseObjectData(
    database.ref('friendRequests').child(uid)
  );
  const friendRequestCount = useMemo(
    () =>
      Object.entries(friendRequests).filter(([otherUid, status]) => {
        return status === 'INCOMING';
      }).length,
    [friendRequests]
  );

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
        <FriendsIcon className="z-10" width={20} height={20} />
        {friendRequestCount > 0 ? (
          <div className="absolute bottom-[-4px] right-[-4px] bg-red-500 rounded-full text-gray-100 px-1 text-sm">
            {friendRequestCount}
          </div>
        ) : null}
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
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg outline-none p-4">
          <Suspense fallback={<div>Loading...</div>}>
            <FriendRequests />
            <Friends />
            <PeopleSearch />
          </Suspense>
        </div>
      </Transition>
    </div>
  );
}
