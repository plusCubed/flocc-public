import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  useAuth,
  useDatabase,
  useDatabaseObjectData,
  useUser,
} from 'reactfire';
import {
  AddIcon,
  Button,
  EnterIcon,
  ExitIcon,
  MatMicrophoneIcon,
  MatMicrophoneOffIcon,
  MicrophoneOffIcon,
  SectionLabel,
} from './ui';
import { RoomState } from './roomRtc';
import usePromise from 'react-promise-suspense';
import birds from '../util/birds';

/**
 * @param {firebase.database.Reference} ref
 * @param childKeys
 */
function useDatabaseObjectDataPartialOnce(ref, childKeys) {
  async function getPartial(ref, keys) {
    /** @type firebase.database.DataSnapshot[] */
    const docSnapshots = await Promise.all(
      keys.map((key) => ref.child(key).once('value'))
    );
    const partial = {};
    for (const snapshot of docSnapshots) {
      partial[snapshot.key] = snapshot.val();
    }
    return partial;
  }

  return usePromise(getPartial, [ref, childKeys]);
}

function RoomUsers({ currentRoomId, roomId, connectionStates }) {
  const database = useDatabase();
  const roomUsers = useDatabaseObjectData(
    database.ref(`rooms/${roomId}/users`)
  );
  const userIds = Object.keys(roomUsers);
  const userDocs = useDatabaseObjectDataPartialOnce(
    database.ref('users'),
    userIds
  );
  const currentUid = useUser().uid;

  return (
    <>
      {userIds.map((uid) => {
        const connecting =
          roomId === currentRoomId &&
          currentUid !== uid &&
          connectionStates[uid] !== 'connected';
        const nameClass = connecting ? 'text-gray-500' : '';
        return (
          <div key={uid} className="flex items-center">
            <div className={'text-sm px-1 ' + nameClass}>
              {userDocs[uid].displayName}
            </div>
            <div className="text-gray-500">
              {roomUsers[uid].mute ? (
                <MatMicrophoneOffIcon width={18} height={18} />
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
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

  let roomName = useDatabaseObjectData(useDatabase().ref(`rooms/${id}/name`));
  if (typeof roomName !== 'string') {
    roomName = '';
  }

  const showLeaveButton =
    currentRoomState === RoomState.JOINED &&
    currentRoomId === id &&
    currentRoomId !== `room-${uid}`;

  return (
    <div
      className={
        'w-full text-left focus:outline-none p-2 pl-3 mb-2 flex shadow-inner rounded bg-gray-100 ' +
        (id !== currentRoomId
          ? 'hover:bg-gray-200 border cursor-pointer'
          : 'border-solid border border-teal-700')
      }
      onClick={join}
    >
      <div className="flex-1 self-center">
        <span className="font-semibold">{roomName}</span>
        <Suspense fallback={<div></div>}>
          <RoomUsers
            currentRoomId={currentRoomId}
            roomId={id}
            connectionStates={connectionStates}
          />
        </Suspense>
      </div>
      {showLeaveButton ? (
        <Button
          className="self-start"
          onClick={leaveRoom}
          disabled={transitioning}
        >
          <ExitIcon width={16} height={16} />
        </Button>
      ) : null}
    </div>
  );
}

export function RoomSelector({
  currentRoomId,
  currentRoomState,
  joinRoom,
  leaveRoom,
  connectionStates,
}) {
  const database = useDatabase();

  const allRooms = useDatabaseObjectData(database.ref('rooms'));
  const roomData = Object.entries(allRooms);
  let permanentIds = [];
  let tempIds = [];
  for (const [id, data] of roomData) {
    if (data.permanent) {
      permanentIds.push(id);
    } else {
      tempIds.push(id);
    }
  }

  const transitioning =
    currentRoomState === RoomState.JOINING ||
    currentRoomState === RoomState.LEAVING;

  const createAndJoinRoom = useCallback(() => {
    joinRoom(null);
  }, [joinRoom]);

  return (
    <div className="mt-2">
      <SectionLabel className="mb-2">Lounges</SectionLabel>
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
      ))}
      <div className="mt-4 mb-2 flex items-center">
        <SectionLabel className="flex-1">Rooms</SectionLabel>
        <Button onClick={createAndJoinRoom} disabled={transitioning}>
          <AddIcon width={16} height={16} />
        </Button>
      </div>
      {tempIds.length === 0 ? (
        <div className="text-gray-400">No rooms</div>
      ) : (
        tempIds.map((id) => (
          <Room
            key={id}
            id={id}
            currentRoomId={currentRoomId}
            connectionStates={connectionStates}
            currentRoomState={currentRoomState}
            leaveRoom={leaveRoom}
            joinRoom={joinRoom}
          />
        ))
      )}
    </div>
  );
}
