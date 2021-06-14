import React, { useCallback, useEffect, useState, Suspense } from 'react';

import { useAuth, useDatabase, useUser } from 'reactfire';

import { isDevelopment } from '../constants/isDevelopment';
import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { useSocket } from '../hooks/useSocket';
import { useSocketRoom } from '../hooks/useSocketRoom';
import { useUid } from '../hooks/useUid';

import { FriendsDropdown } from './friendsDropdown';
import { MatMicrophoneIcon, MatMicrophoneOffIcon } from './icons';
import { Music } from './music';
import { RoomList } from './roomList';
import { RoomRtc } from './roomRtc';
import { SettingsDropdown } from './settingsDropdown';
import { StatusIndicator } from './statusIndicator';

const SOCKET_ENDPOINT =
  /*isDevelopment
  ? 'http://localhost:3010'
  :*/ 'https://server.flocc.app:8443';

function MuteButton({ roomId, socket }) {
  const database = useDatabase();
  const uid = useUid();
  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const toggleMute = useCallback(() => {
    socket.emit('toggle_mute');
  }, [socket]);

  const roomUserCount = useDatabaseListData(
    database.ref(`rooms/${roomId}/users`)
  ).length;

  const enabled = roomUserCount > 1;
  return (
    <button
      className={`has-tooltip p-1 ml-1 rounded focus:outline-none ${
        enabled ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400'
      }`}
      onClick={toggleMute}
      disabled={!enabled}
    >
      {mute ? (
        <MatMicrophoneOffIcon width={20} height={20} />
      ) : (
        <MatMicrophoneIcon width={20} height={20} />
      )}
      <div className="tooltip rounded shadow-lg p-2 px-4 text-gray-700 bg-gray-100 mt-2 whitespace-pre">
        To control mute,{'\n'}get in a call!
      </div>
    </button>
  );
}

function FocusListener({
  socket,
  roomId,
  transitioningRef,
  joinRoom,
  leaveRoom,
}) {
  const database = useDatabase();
  const roomUsers = useDatabaseListData(database.ref(`rooms/${roomId}/users`));
  const roomUserCount = roomUsers.length;

  useEffect(() => {
    let timeoutId = null;
    const onfocus = (event) => {
      console.log('focus');
      if (!socket) return;

      socket.emit('active');
      if (!roomId && !transitioningRef.current) {
        console.log('joining new room on focus');
        joinRoom(null, false);
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onblur = async (event) => {
      console.log('blur');
      if (!socket) return;

      timeoutId = setTimeout(async () => {
        // only user in a room => idle
        if (roomUserCount <= 1) {
          console.log('idle');
          socket.emit('idle');
          if (roomUserCount === 1) {
            leaveRoom().catch((e) => console.error(e));
          }
        } else {
          console.log('not idling: more than 1 person in room');
        }
      }, 5 * 60 * 1000); // 5 min
    };

    if (document.hasFocus()) {
      onfocus();
    } else {
      onblur();
    }

    window.addEventListener('focus', onfocus);
    window.addEventListener('blur', onblur);
    return () => {
      window.removeEventListener('focus', onfocus);
      window.removeEventListener('blur', onblur);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    database,
    joinRoom,
    leaveRoom,
    roomId,
    roomUserCount,
    socket,
    transitioningRef,
  ]);
  return <></>;
}

export function Home() {
  const database = useDatabase();
  const user = useUser().data;
  const { displayName, email, photoURL, uid } = user;

  const { socket, connected } = useSocket(SOCKET_ENDPOINT, user);
  const { roomId, joinRoom, leaveRoom, transitioningRef } = useSocketRoom(
    socket,
    connected
  );

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const status = useDatabaseObjectData(database.ref(`users/${uid}/status`));

  return (
    <div className="p-2 mx-auto w-full max-w-lg h-full">
      <Suspense fallback={null}>
        <FocusListener
          socket={socket}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
          roomId={roomId}
          transitioningRef={transitioningRef}
        />
      </Suspense>
      {!connected ? (
        <div className="flex justify-center items-center w-full h-full">
          Connecting to server...
        </div>
      ) : (
        <div className="flex flex-col w-full h-full">
          <div className="flex items-center font-semibold">
            <div>{displayName}</div>
            <StatusIndicator status={status} className="ml-1" />
            <Suspense fallback={null}>
              <MuteButton roomId={roomId} socket={socket} />
            </Suspense>
            <div className="flex-1" />
            <FriendsDropdown />
            <SettingsDropdown signOut={signOut} />
          </div>
          <div className="flex overflow-y-auto flex-col flex-1">
            <div className="flex-1 mt-2">
              <Suspense fallback={null}>
                <RoomList
                  currentRoomId={roomId}
                  joinRoom={joinRoom}
                  leaveRoom={leaveRoom}
                  connectionStates={connectionStates}
                />
              </Suspense>
            </div>
          </div>
          <RoomRtc
            socket={socket}
            mute={mute}
            onConnectionStatesChange={setConnectionStates}
          />
          {roomId ? (
            <Suspense fallback={null}>
              <Music currentRoomId={roomId} />
            </Suspense>
          ) : null}
        </div>
      )}
    </div>
  );
}
