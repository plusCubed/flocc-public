import React, { Suspense, useCallback, useMemo } from 'react';
import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';
import { Button, SectionLabel } from './ui';
import {
  ExitIcon,
  LockClosedIcon,
  LockOpenIcon,
  MatMicrophoneOffIcon,
} from './icons';
import { useDatabaseObjectDataPartial } from '../hooks/useDatabaseObjectDataPartial';
import { StatusIndicator } from './statusIndicator';

function RoomUsers({ currentRoomId, roomId, roomUsers, connectionStates }) {
  const database = useDatabase();
  const userIds = useMemo(() => Object.keys(roomUsers), [roomUsers]);
  const userDocs = useDatabaseObjectDataPartial('users', userIds);
  const currentUid = useUser().uid;

  return userIds.map((uid) => {
    const connecting =
      roomId === currentRoomId &&
      currentUid !== uid &&
      connectionStates[uid] !== 'connected';
    const nameClass = connecting ? 'text-gray-500' : '';
    const userDoc = userDocs?.[uid];
    return (
      <div key={uid} className="flex items-center">
        <StatusIndicator status={userDoc?.status} />
        <div className={'text-sm px-1 ' + nameClass}>
          {userDoc?.displayName ?? '...'}
        </div>
        <div className="text-gray-500">
          {userDoc?.mute ? (
            <MatMicrophoneOffIcon width={18} height={18} />
          ) : null}
        </div>
      </div>
    );
  });
}

function Room({
  roomId,
  currentRoomId,
  connectionStates,
  leaveRoom,
  joinRoom,
}) {
  const uid = useUser().uid;

  const join = useCallback(() => {
    joinRoom(roomId);
  }, [roomId, joinRoom]);

  const database = useDatabase();
  let roomName = useDatabaseObjectData(database.ref(`rooms/${roomId}/name`));
  if (typeof roomName !== 'string') {
    roomName = '';
  }

  const isInCurrentRoom = currentRoomId === roomId;

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

  const containerStyles = isInCurrentRoom
    ? ' border border-solid bg-gray-100 ' +
      (locked ? ' border-red-500' : ' border-transparent')
    : ' hover:bg-gray-200 cursor-pointer';
  return (
    <div
      className={
        'w-full flex items-center text-left focus:outline-none p-1.5 pl-3 mb-1 rounded' +
        containerStyles
      }
      onClick={join}
    >
      <div className="flex-1 self-center">
        <span className="font-semibold">{roomName}</span>
        <Suspense fallback={<div></div>}>
          <RoomUsers
            currentRoomId={currentRoomId}
            roomId={roomId}
            roomUsers={roomUsers}
            connectionStates={connectionStates}
          />
        </Suspense>
      </div>

      {isInCurrentRoom && roomUserCount > 1 ? (
        <button
          className="py-1 px-2 ml-1 text-gray-700 rounded focus:outline-none hover:bg-gray-200"
          onClick={toggleLock}
          disabled={!isInCurrentRoom}
        >
          {locked ? (
            <span className="text-red-500">
              <LockClosedIcon width={16} height={16} />
            </span>
          ) : (
            <LockOpenIcon width={16} height={16} />
          )}
        </button>
      ) : null}

      {isInCurrentRoom && roomUserCount > 1 ? (
        <Button
          className="ml-1"
          onClick={() => {
            joinRoom(null, false); // create new room
          }}
        >
          <ExitIcon width={16} height={16} />
        </Button>
      ) : null}
    </div>
  );
}

function User({ userId, callFriend, status }) {
  const database = useDatabase();
  const userDoc = useDatabaseObjectData(database.ref('users').child(userId));
  const isActive = status === 'ACTIVE';
  return (
    <div
      className={
        'w-full flex items-center text-left focus:outline-none p-1.5 pl-3 mb-1 rounded ' +
        (isActive ? 'hover:bg-gray-200' : '')
      }
      onClick={() => {
        if (isActive) {
          callFriend(userId);
        }
      }}
    >
      <StatusIndicator status={status} />
      <div className="ml-2">{userDoc.displayName}</div>
    </div>
  );
}

export function RoomList({
  currentRoomId,
  //call,
  joinRoom,
  leaveRoom,
  connectionStates,
}) {
  const uid = useUser().uid;
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

  const friendRooms =
    useDatabaseObjectDataPartial('rooms', friendRoomIds) || {};
  const currentRoomLocked = friendRooms[currentRoomId]?.locked;
  let tempIds = [];

  for (const [id, roomData] of Object.entries(friendRooms)) {
    if (id === currentRoomId) {
      tempIds.splice(0, 0, id);
    } else if (!roomData.locked && !currentRoomLocked) {
      tempIds.push(id);
    }
  }

  /*const activeFriends = friendDocEntries
    .filter((entry) => !isFriendInARoom(entry))
    .filter(([friendUid, friendDoc]) => {
      return friendDoc.status === 'ACTIVE';
    })
    .map(([friendUid, friendDoc]) => friendUid);*/
  const inactiveFriends = friendDocEntries
    .filter((entry) => !isFriendInARoom(entry))
    .filter(([friendUid, friendDoc]) => {
      return friendDoc.status !== 'ACTIVE';
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
      {tempIds.map((id) => (
        <Room
          key={id}
          roomId={id}
          currentRoomId={currentRoomId}
          connectionStates={connectionStates}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
        />
      ))}
      {/*{activeFriends.map((friendUid) => (
        <Suspense key={friendUid} fallback={<div>Loading</div>}>
          <User
            userId={friendUid}
            callFriend={call}
            status={friendDocs[friendUid].status}
          />
        </Suspense>
      ))}*/}
      <SectionLabel className="flex-1 mt-4">Inactive</SectionLabel>
      {inactiveFriends.map((friendUid) => (
        <Suspense key={friendUid} fallback={<div>Loading</div>}>
          <User userId={friendUid} status={friendDocs[friendUid].status} />
        </Suspense>
      ))}
      {/*{currentRoomLocked ? (*/}
      {/*  <div className="text-center text-gray-400">*/}
      {/*    <div>Unlock to join friend rooms,</div>*/}
      {/*    <div>and let friends join yours!</div>*/}
      {/*  </div>*/}
      {/*) : null}*/}
    </div>
  );
}
