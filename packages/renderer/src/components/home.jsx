import React, { useCallback, useEffect, useState, Suspense } from 'react';

import { useAuth, useDatabase, useUser } from 'reactfire';

import { isDevelopment } from '../constants/isDevelopment';
import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { useSocket, useSocketListener } from '../hooks/useSocket';
import { useSocketRoom } from '../hooks/useSocketRoom';
import { useUid } from '../hooks/useUid';

import { FriendsDropdown } from './friendsDropdown';
import { MatMicrophoneIcon, MatMicrophoneOffIcon } from './icons';
import { HelpPopup } from './infoDropdown';
import { Music } from './music';
import { RoomList } from './roomList';
import { RoomRtc } from './roomRtc';
import { SettingsDropdown } from './settingsDropdown';
import { StatusIndicator } from './statusIndicator';

const LOCAL_SERVER = true;
const SOCKET_ENDPOINT =
  isDevelopment && LOCAL_SERVER
    ? 'http://localhost:3010'
    : 'https://server.flocc.app:8443';

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

function VisibilityListener({
  socket,
  roomId,
  transitioningRef,
  joinRoom,
  leaveRoom,
}) {
  const database = useDatabase();
  const roomUsers = useDatabaseListData(database.ref(`rooms/${roomId}/users`));
  const roomUserCount = roomUsers.length; // reset visibility detection when room user count changes

  useEffect(() => {
    let timeoutId = null;
    const onVisible = () => {
      console.log('visible');
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

    const onHidden = async () => {
      console.log('hidden');
      if (!socket) return;

      timeoutId = setTimeout(
        async () => {
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
        },
        isDevelopment ? 10 * 1000 : 5 * 60 * 1000
      ); // 5 min
    };

    const handleVisibilityChange = () => {
      if (document['hidden']) {
        onHidden();
      } else {
        onVisible();
      }
    };

    // do initial detection
    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

function usePing(socket, database) {
  const ping = useCallback(
    (uid) => {
      if (!socket) return;

      socket.emit('ping', { peerUid: uid });
    },
    [socket]
  );

  // Only works on desktop for now - web notifications require workers
  const pinged = useCallback(
    async ({ peerUid, peerSocketId }) => {
      const name = (
        await database.ref(`users/${peerUid}/displayName`).once('value')
      ).val();
      console.log(`pinged by ${name}`);
      const notification = new Notification(`${name} pinged you!`);
      setTimeout(() => {
        notification.close();
      }, 5000);
    },
    [database]
  );
  useSocketListener(socket, 'pinged', pinged);
  return ping;
}

export function Home() {
  const database = useDatabase();
  const user = useUser().data;
  const { uid } = user;

  const displayName = useDatabaseObjectData(
    database.ref(`users/${uid}/displayName`)
  );

  const { socket, connected } = useSocket(SOCKET_ENDPOINT, user);
  const { roomId, joinRoom, leaveRoom, transitioningRef } = useSocketRoom(
    socket,
    connected
  );
  const ping = usePing(socket, database);

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const status = useDatabaseObjectData(database.ref(`users/${uid}/status`));

  console.log('room id', roomId);

  return (
    <div className="p-2 mx-auto w-full max-w-lg h-full">
      <Suspense fallback={null}>
        <VisibilityListener
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
                  ping={ping}
                  connectionStates={connectionStates}
                />
              </Suspense>
            </div>
          </div>
          <div className="flex flex-row">
            <div className="flex-1" />
            <HelpPopup />
          </div>
          <RoomRtc
            socket={socket}
            mute={mute}
            onConnectionStatesChange={setConnectionStates}
          />
          {roomId ? (
            <Suspense fallback={null}>
              <Music currentRoomId={roomId} socket={socket} />
            </Suspense>
          ) : null}
        </div>
      )}
    </div>
  );
}
