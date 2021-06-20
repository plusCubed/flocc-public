import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

import { BellIcon, ExitIcon, MatMicrophoneOffIcon } from './icons';
import { StatusIndicator } from './statusIndicator';
import { Button, SectionLabel } from './ui';

function RoomUser({ ping, currentRoomId, roomId, uid, connectionState }) {
  const database = useDatabase();
  const selfUid = useUid();

  const isCurrentRoom = roomId && roomId === currentRoomId;
  const connecting =
    isCurrentRoom && selfUid !== uid && connectionState !== 'connected';
  const nameClass = connecting ? 'text-gray-500' : '';

  const userDoc = useDatabaseObjectData(database.ref(`users/${uid}`));
  const status = userDoc?.status;

  const [pingSent, setPingSent] = useState(false);
  useEffect(() => {
    let timeout;
    if (pingSent) {
      timeout = setTimeout(() => {
        setPingSent(false);
      }, 200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [pingSent]);

  const [hover, setHover] = useState(false);

  const showPingButton =
    !!ping &&
    ((status === 'ACTIVE' && hover) || status === 'IDLE') &&
    selfUid !== uid;

  return (
    <div
      className={`flex items-center h-6 ${pingSent ? 'shake' : ''}`}
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
    >
      <StatusIndicator status={status} />
      <div className={`px-2 ${nameClass}`}>{userDoc?.displayName ?? '...'}</div>
      <div className="text-gray-400">
        {isCurrentRoom && userDoc?.mute ? (
          <MatMicrophoneOffIcon width={18} height={18} />
        ) : null}
      </div>

      {showPingButton ? (
        <div
          className="p-1 text-gray-500 rounded focus:outline-none hover:bg-gray-200 active:bg-gray-300"
          onClick={(e) => {
            e.stopPropagation();
            ping(uid);
            setPingSent(true);
          }}
        >
          <BellIcon width={18} height={18} />
        </div>
      ) : null}

      {/*<Toast
        open={pingSent}
        setOpen={setPingSent}
        text={`Pinged ${userDoc?.displayName}`}
      />*/}
    </div>
  );
}

function RoomUsers({
  currentRoomId,
  roomId,
  roomUsers,
  connectionStates,
  ping,
}) {
  const userIds = useMemo(() => Object.keys(roomUsers), [roomUsers]);
  return userIds.map((uid) => (
    <Suspense key={uid} fallback={null}>
      <RoomUser
        currentRoomId={currentRoomId}
        roomId={roomId}
        uid={uid}
        connectionState={connectionStates[uid]}
        ping={ping}
      />
    </Suspense>
  ));
}

function Room({ roomId, currentRoomId, connectionStates, joinRoom, ping }) {
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
          ping={ping}
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

  const friendRoomIdsList = useMemo(
    () =>
      friendDocEntries
        .filter(([friendUid, friendDoc]) => {
          return friendDoc.status === 'ACTIVE';
        })
        .filter(([friendUid, friendDoc]) => {
          return !!friendDoc.room;
        })
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
          ping={ping}
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
