import React, { Suspense, useCallback } from 'react';
import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';
import {
  Button,
  ExitIcon,
  LockClosedIcon,
  LockOpenIcon,
  MatMicrophoneOffIcon,
  SectionLabel,
} from './ui';
import { RoomState } from './roomRtc';
import usePromise from 'react-promise-suspense';

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

  const database = useDatabase();
  let roomName = useDatabaseObjectData(database.ref(`rooms/${id}/name`));
  if (typeof roomName !== 'string') {
    roomName = '';
  }

  const isInCurrentRoom =
    currentRoomState === RoomState.JOINED && currentRoomId === id;

  const roomUsers = useDatabaseObjectData(
    database.ref(`rooms/${currentRoomId}/users`)
  );

  const permanent =
    useDatabaseObjectData(database.ref(`rooms/${id}/permanent`)) === true;

  const showLeaveButton =
    isInCurrentRoom && (permanent || Object.keys(roomUsers).length >= 2);

  const locked =
    useDatabaseObjectData(database.ref(`rooms/${id}/locked`)) === true;
  const toggleLock = useCallback(() => {
    database.ref(`rooms/${id}/locked`).set(!locked);
  }, [database, id, locked]);

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

      {(locked || isInCurrentRoom) && !permanent ? (
        <button
          className="self-start focus:outline-none rounded text-gray-700 hover:bg-gray-200 ml-1 px-2 py-1"
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

      {showLeaveButton ? (
        <Button
          className="self-start ml-1"
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
    <div className="mt-2">
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
        <div className="text-gray-400">
          <div>Unlock to join friend rooms,</div>
          <div>and let friends join yours!</div>
        </div>
      ) : null}
    </div>
  );
}
