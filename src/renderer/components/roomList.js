import React, { Suspense, useCallback, useMemo } from 'react';
import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';
import { Button, SectionLabel } from './ui';
import {
  AddIcon,
  ExitIcon,
  LockClosedIcon,
  LockOpenIcon,
  MatMicrophoneOffIcon,
} from './icons';
import { useDatabaseObjectDataPartial } from '../hooks/useDatabaseObjectDataPartial';
import RoomState from '../../../common/roomState';

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
  id,
  currentRoomId,
  connectionStates,
  currentRoomState,
  leaveRoom,
  joinRoom,
}) {
  const uid = useUser().uid;
  const transitioning =
    currentRoomState === RoomState.JOINING ||
    currentRoomState === RoomState.LEAVING;

  const join = useCallback(() => {
    joinRoom(id);
  }, [id, joinRoom]);

  const database = useDatabase();
  let roomName = useDatabaseObjectData(database.ref(`rooms/${id}/name`));
  if (typeof roomName !== 'string') {
    roomName = '';
  }

  const isInCurrentRoom =
    currentRoomState === RoomState.JOINED && currentRoomId === id;

  const roomUsers = useDatabaseObjectData(database.ref(`rooms/${id}/users`));

  const roomUserCount = Object.keys(roomUsers).length;

  const locked =
    useDatabaseObjectData(database.ref(`rooms/${id}/locked`)) === true;
  const toggleLock = useCallback(() => {
    database.ref(`rooms/${id}/locked`).set(!locked);
  }, [database, id, locked]);

  if (roomUserCount === 0) {
    return null;
  }
  return (
    <div
      className={
        'w-full flex items-center text-left focus:outline-none p-1.5 pl-3 mb-1 rounded' +
        (id === currentRoomId
          ? ' border border-solid bg-gray-100 ' +
            (locked ? ' border-red-500' : ' border-transparent')
          : ' hover:bg-gray-200 cursor-pointer')
      }
      onClick={join}
    >
      <div className="flex-1 self-center">
        <span className="font-semibold">{roomName}</span>
        <Suspense fallback={<div></div>}>
          <RoomUsers
            currentRoomId={currentRoomId}
            roomId={id}
            roomUsers={roomUsers}
            connectionStates={connectionStates}
          />
        </Suspense>
      </div>

      {isInCurrentRoom && roomUserCount > 1 ? (
        <button
          className="focus:outline-none rounded text-gray-700 hover:bg-gray-200 ml-1 px-2 py-1"
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
        <Button className="ml-1" onClick={leaveRoom} disabled={transitioning}>
          <ExitIcon width={16} height={16} />
        </Button>
      ) : null}
    </div>
  );
}

export function RoomList({
  currentRoomId,
  currentRoomState,
  joinRoom,
  leaveRoom,
  connectionStates,
}) {
  const database = useDatabase();

  const allRooms = useDatabaseObjectData(database.ref('rooms'));
  const currentRoomLocked = allRooms[currentRoomId]?.locked;
  let permanentIds = [];
  let tempIds = [];

  for (const [id, roomData] of Object.entries(allRooms)) {
    if (roomData.permanent) {
      permanentIds.push(id);
    } else {
      if (id === currentRoomId) {
        tempIds.splice(0, 0, id);
      } else if (!roomData.locked && !currentRoomLocked) {
        tempIds.push(id);
      }
    }
  }

  const transitioning =
    currentRoomState === RoomState.JOINING ||
    currentRoomState === RoomState.LEAVING;

  const createAndJoinRoom = useCallback(() => {
    joinRoom(null);
  }, [joinRoom]);

  return (
    <div>
      {/*<SectionLabel className="mb-2">Lounges</SectionLabel>
      {permanentIds.map((id) => (
        <Room
          key={id}
          id={id}
          currentRoomId={currentRoomId}
          connectionStates={connectionStates}
          currentRoomState={currentRoomState}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
        />
      ))}*/}
      <div className="mb-2 flex items-center">
        <SectionLabel className="flex-1">Rooms</SectionLabel>
        {/*<Button onClick={createAndJoinRoom} disabled={transitioning}>
          <AddIcon width={16} height={16} />
        </Button>*/}
      </div>
      {tempIds.map((id) => (
        <Room
          key={id}
          id={id}
          currentRoomId={currentRoomId}
          connectionStates={connectionStates}
          currentRoomState={currentRoomState}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
        />
      ))}
      {currentRoomLocked ? (
        <div className="text-gray-400 text-center">
          <div>Unlock to join friend rooms,</div>
          <div>and let friends join yours!</div>
        </div>
      ) : null}
    </div>
  );
}
