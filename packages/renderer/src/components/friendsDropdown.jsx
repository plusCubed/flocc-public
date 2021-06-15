import React, { Suspense, useMemo } from 'react';

import { Transition, Popover } from '@headlessui/react';
import { useDatabase } from 'reactfire';

import { useDatabaseObjectData } from '../hooks/useDatabase';
import { useUid } from '../hooks/useUid';

import { FriendRequests, Friends, PeopleSearch } from './friends';
import { FriendsIcon } from './icons';

export function FriendsDropdown() {
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
            <Popover.Overlay className="fixed inset-0 bg-overlay" />
          </Transition>
          <Popover.Button
            className={
              'relative focus:outline-none rounded text-gray-700 ml-1 p-1 ' +
              (open ? 'bg-gray-400' : 'hover:bg-gray-200')
            }
          >
            <FriendsIcon className="z-10" width={20} height={20} />
            {friendRequestCount > 0 ? (
              <div className="absolute bottom-[-4px] right-[-4px] bg-red-500 rounded-full text-gray-100 px-1 text-sm">
                {friendRequestCount}
              </div>
            ) : null}
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
            <Popover.Panel className="absolute right-0 p-4 mt-2 w-64 bg-white rounded-md border border-gray-200 shadow-lg origin-top-right outline-none">
              <Suspense fallback={<div>Loading...</div>}>
                <FriendRequests />
                <Friends />
                <PeopleSearch />
              </Suspense>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
