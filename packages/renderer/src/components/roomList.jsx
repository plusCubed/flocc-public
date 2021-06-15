import React, {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { useDatabase } from 'reactfire';
import { useRecoilValue } from 'recoil';

import joinedSound from '../../assets/sounds/joined.wav';
import leftSound from '../../assets/sounds/left.wav';
import { audioOutputAtom } from '../atoms/audioDeviceAtom';
import {
  useDatabaseObjectData,
  useDatabaseObjectDataPartial,
} from '../hooks/useDatabase';
import { useUid } from '../hooks/useUid';
import { playSound } from '../util/playSound';

import { BellIcon, CloseIcon, ExitIcon, MatMicrophoneOffIcon } from './icons';
import { StatusIndicator } from './statusIndicator';
import { Button, SectionLabel } from './ui';

function PingSentToast({ open, setOpen, name }) {
  return (
    <Transition
      appear
      show={open}
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      as={Fragment}
    >
      <Dialog
        className="fixed bottom-10 bg-gray-50 rounded shadow-md m-4 pl-4 pr-3 py-3 flex"
        onClose={() => setOpen(false)}
      >
        <div>Pinged {name}</div>
        <div className="flex-1 w-5" />
        <button
          className="focus:outline-none text-gray-400 hover:text-gray-600 active:text-gray-800"
          onClick={() => setOpen(false)}
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </Dialog>
    </Transition>
  );
}

function RoomUser({ ping, currentRoomId, roomId, uid, connectionState }) {
  const database = useDatabase();
  const currentUid = useUid();

  const isCurrentRoom = roomId && roomId === currentRoomId;
  const connecting =
    isCurrentRoom && currentUid !== uid && connectionState !== 'connected';
  const nameClass = connecting ? 'text-gray-500' : '';

  const userDoc = useDatabaseObjectData(database.ref(`users/${uid}`));
  const status = userDoc?.status;

  const [pingSent, setPingSent] = useState(false);
  useEffect(() => {
    let timeout;
    if (pingSent) {
      timeout = setTimeout(() => {
        setPingSent(false);
      }, 1000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [pingSent]);

  return (
    <div className="flex items-center h-6">
      <StatusIndicator status={status} />
      <div className={`px-2 ${nameClass}`}>{userDoc?.displayName ?? '...'}</div>
      <div className="text-gray-400">
        {isCurrentRoom && userDoc?.mute ? (
          <MatMicrophoneOffIcon width={18} height={18} />
        ) : null}
      </div>

      {!!ping ? (
        <div
          className="p-1 text-gray-600 rounded focus:outline-none hover:bg-gray-200 active:bg-gray-300"
          onClick={() => {
            ping(uid);
            setPingSent(true);
          }}
        >
          {status === 'IDLE' ? <BellIcon width={18} height={18} /> : null}
        </div>
      ) : null}

      <PingSentToast
        open={pingSent}
        setOpen={setPingSent}
        name={userDoc?.displayName}
      />
    </div>
  );
}

function RoomUsers({ currentRoomId, roomId, roomUsers, connectionStates }) {
  const userIds = useMemo(() => Object.keys(roomUsers), [roomUsers]);
  return userIds.map((uid) => (
    <Suspense key={uid} fallback={null}>
      <RoomUser
        currentRoomId={currentRoomId}
        roomId={roomId}
        uid={uid}
        connectionState={connectionStates[uid]}
      />
    </Suspense>
  ));
}

function Room({ roomId, currentRoomId, connectionStates, joinRoom }) {
  const outputDevice = useRecoilValue(audioOutputAtom);
  const join = useCallback(async () => {
    const success = await joinRoom(roomId);
    if (success) {
      console.log('me join: play sound');
      playSound(joinedSound, outputDevice);
    }
  }, [outputDevice, joinRoom, roomId]);
  const leave = useCallback(async () => {
    const success = await joinRoom(null, false); // create new room
    if (success) {
      console.log('me leave: play sound');
      playSound(leftSound, outputDevice);
    }
  }, [joinRoom, outputDevice]);

  const database = useDatabase();
  let roomName = useDatabaseObjectData(database.ref(`rooms/${roomId}/name`));
  if (typeof roomName !== 'string') {
    roomName = '';
  }

  const isCurrentRoom = roomId && roomId === currentRoomId;

  const roomUsers = useDatabaseObjectData(
    database.ref(`rooms/${roomId}/users`)
  );

  const roomUserCount = Object.keys(roomUsers).length;

  const locked =
    useDatabaseObjectData(database.ref(`rooms/${roomId}/locked`)) === true;
  const toggleLock = useCallback(() => {
    database.ref(`rooms/${roomId}/locked`).set(!locked);
  }, [database, roomId, locked]);

  if (roomUserCount === 0) {
    return null;
  }

  let containerStyles =
    'w-full flex items-center text-left focus:outline-none p-1.5 pl-3 mb-1 rounded border border-solid ';
  if (isCurrentRoom) {
    if (locked) {
      containerStyles += 'bg-gray-100 border-red-500';
    } else {
      containerStyles += 'bg-gray-100 border-transparent';
    }
  } else {
    containerStyles += 'hover:bg-gray-200 border-transparent';
  }

  return (
    <div className={containerStyles} onClick={join}>
      <div className="flex-1 self-center">
        <span className="font-semibold">{roomName}</span>
        <RoomUsers
          currentRoomId={currentRoomId}
          roomId={roomId}
          roomUsers={roomUsers}
          connectionStates={connectionStates}
        />
      </div>

      {/*{isCurrentRoom && roomUserCount > 1 ? (
        <button
          className="py-1 px-2 ml-1 text-gray-700 rounded focus:outline-none hover:bg-gray-200"
          onClick={toggleLock}
          disabled={!isCurrentRoom}
        >
          {locked ? (
            <span className="text-red-500">
              <LockClosedIcon width={16} height={16} />
            </span>
          ) : (
            <LockOpenIcon width={16} height={16} />
          )}
        </button>
      ) : null}*/}

      {isCurrentRoom && roomUserCount > 1 ? (
        <Button className="ml-1" onClick={leave}>
          <ExitIcon width={16} height={16} />
        </Button>
      ) : null}
    </div>
  );
}

export function RoomList({
  currentRoomId,
  joinRoom,
  leaveRoom,
  ping,
  connectionStates,
}) {
  const uid = useUid();
  const database = useDatabase();

  const friends = useDatabaseObjectData(database.ref('friends').child(uid));
  const friendUids = useMemo(() => Object.keys(friends), [friends]);
  const friendDocs = useDatabaseObjectDataPartial('users', friendUids);
  const friendDocEntries = useMemo(
    () => Object.entries(friendDocs || {}),
    [friendDocs]
  );

  const isFriendInARoom = ([friendUid, friendDoc]) => {
    return friendDoc.room;
  };
  const friendRoomIdsList = useMemo(
    () =>
      friendDocEntries
        .filter(isFriendInARoom)
        .map(([friendUid, friendDoc]) => friendDoc.room),
    [friendDocEntries]
  );
  const friendRoomIds = useMemo(
    () => [...new Set(friendRoomIdsList)],
    [friendRoomIdsList]
  );

  const friendRooms = useDatabaseObjectDataPartial('rooms', friendRoomIds);
  const roomIds = useMemo(() => {
    let roomIds = [];
    for (const [id, roomData] of Object.entries(friendRooms)) {
      if (id === currentRoomId) {
        // current room at the top
        roomIds.splice(0, 0, id);
      } else if (!roomData.locked) {
        // room not locked
        roomIds.push(id);
      }
    }
    return roomIds;
  }, [currentRoomId, friendRooms]);

  const inactiveFriends = friendDocEntries
    .filter((entry) => !isFriendInARoom(entry))
    .filter(([friendUid, friendDoc]) => {
      return friendDoc.status !== 'ACTIVE';
    })
    .sort(([friendUid1, friendDoc1], [friendUid2, friendDoc2]) => {
      return (
        friendDoc1.status.localeCompare(friendDoc2.status) ||
        friendDoc1.displayName.localeCompare(friendDoc2.displayName)
      );
    })
    .map(([friendUid, friendDoc]) => friendUid);

  return (
    <div>
      <div className="flex items-center mb-2">
        <SectionLabel className="flex-1">Active</SectionLabel>
        {/*<Button onClick={createAndJoinRoom} disabled={transitioning}>
          <AddIcon width={16} height={16} />
        </Button>*/}
      </div>
      {roomIds.map((roomId) => (
        <Room
          key={roomId}
          roomId={roomId}
          currentRoomId={currentRoomId}
          connectionStates={connectionStates}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
        />
      ))}
      <SectionLabel className="flex-1 mt-4 mb-1">Inactive</SectionLabel>
      {inactiveFriends.map((friendUid) => (
        <Suspense key={friendUid} fallback={<div>Loading</div>}>
          <div className="w-full flex items-center text-left focus:outline-none px-1.5 pl-3 mb-1 rounded">
            <RoomUser uid={friendUid} ping={ping} />
          </div>
        </Suspense>
      ))}
    </div>
  );
}
