import React, { useCallback, useEffect, useState, Suspense } from 'react';
import {
  useAuth,
  useDatabase,
  useDatabaseListData,
  useDatabaseObjectData,
  useUser,
} from 'reactfire';

import { RoomRtc } from './roomRtc';
import { useSocket } from '../hooks/useSocket';
import { RoomList } from './roomList';
import { Music } from './music';
import { useSocketRoom } from '../hooks/useSocketRoom';
import { SettingsDropdown } from './settingsDropdown';
import { MatMicrophoneIcon, MatMicrophoneOffIcon } from './icons';
import { isDevelopment } from '../util/isDevelopment';
import { FriendsDropdown } from './friendsDropdown';
import { StatusIndicator } from './statusIndicator';

const SOCKET_ENDPOINT = isDevelopment
  ? 'http://localhost:3010'
  : 'https://server.flocc.app:8443';

export function Home() {
  const database = useDatabase();
  const user = useUser();
  const { displayName, email, photoURL, uid } = user;

  const [inputDevice, setInputDevice] = useState('');
  const [outputDevice, setOutputDevice] = useState('');

  const { socket, connected } = useSocket(SOCKET_ENDPOINT, user);
  const { roomId, joinRoom, leaveRoom, transitioningRef } = useSocketRoom(
    socket,
    connected
  );

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

      const roomUserCount = (
        await database.ref(`rooms/${roomId}/users`).once('value')
      ).numChildren();

      if (roomUserCount === 1) {
        // not in a room => idle in 5 min
        timeoutId = setTimeout(() => {
          console.log('idle');
          socket.emit('idle');
          leaveRoom().catch((e) => console.error(e));
        }, 5 * 60 * 1000); // 5 min
      }
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
  }, [database, joinRoom, leaveRoom, roomId, socket, transitioningRef]);

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const toggleMute = useCallback(() => {
    socket.emit('toggle_mute');
  }, [socket]);

  const status = useDatabaseObjectData(database.ref(`users/${uid}/status`));

  return (
    <div className="p-2 mx-auto w-full max-w-lg h-full">
      {!connected ? (
        <div className="flex justify-center items-center w-full h-full">
          Connecting to server...
        </div>
      ) : (
        <div className="flex flex-col w-full h-full">
          <div className="flex items-center font-semibold">
            <div>{displayName}</div>
            <StatusIndicator status={status} className="ml-1" />
            <button
              className="relative p-1 ml-1 text-gray-700 rounded focus:outline-none hover:bg-gray-200"
              onClick={toggleMute}
            >
              {mute ? (
                <MatMicrophoneOffIcon width={20} height={20} />
              ) : (
                <MatMicrophoneIcon width={20} height={20} />
              )}
            </button>
            <div className="flex-1" />
            <FriendsDropdown
              signOut={signOut}
              inputDevice={inputDevice}
              outputDevice={outputDevice}
              setInputDevice={setInputDevice}
              setOutputDevice={setOutputDevice}
            />
            <SettingsDropdown
              signOut={signOut}
              inputDevice={inputDevice}
              outputDevice={outputDevice}
              setInputDevice={setInputDevice}
              setOutputDevice={setOutputDevice}
            />
          </div>
          <div className="flex overflow-y-auto flex-col flex-1">
            <div className="flex-1 mt-2">
              <RoomList
                currentRoomId={roomId}
                joinRoom={joinRoom}
                leaveRoom={leaveRoom}
                connectionStates={connectionStates}
              />
            </div>
          </div>
          <RoomRtc
            socket={socket}
            inputDevice={inputDevice}
            outputDevice={outputDevice}
            mute={mute}
            onConnectionStatesChange={setConnectionStates}
          />
          {/*{roomId ? <Music currentRoomId={roomId} /> : null}*/}
        </div>
      )}
    </div>
  );
}
