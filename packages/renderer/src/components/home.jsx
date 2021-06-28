import React, { Suspense, useCallback, useState } from 'react';

import { useAuth, useDatabase, useUser } from 'reactfire';

import { isDevelopment } from '../constants/isDevelopment';
import { useDatabaseObjectData } from '../hooks/useDatabase';
import { usePing } from '../hooks/usePing';
import { useSocket } from '../hooks/useSocket';
import { useSocketRoom } from '../hooks/useSocketRoom';

import { FriendsDropdown } from './friendsDropdown';
import { HelpPopup } from './infoDropdown';
import { Music } from './music';
import { MuteButton } from './muteButton';
import { RoomList } from './roomList';
import { RoomRtc } from './roomRtc';
import { SettingsDropdown } from './settingsDropdown';
import { StatusIndicator } from './statusIndicator';
import { Toast } from './toast';
import { VisibilityListener } from './visibilityListener';

const LOCAL_SERVER = false;
const SOCKET_ENDPOINT =
  isDevelopment && LOCAL_SERVER
    ? 'http://localhost:3010'
    : 'https://server.flocc.app:8443';

export function Home({ authState, authSignOut }) {
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
  const { ping, incomingPings, clearPings, justPinged } = usePing(
    socket,
    database
  );

  const signOut = useCallback(async () => {
    await leaveRoom();
    authSignOut();
  }, [authSignOut, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const status = useDatabaseObjectData(database.ref(`users/${uid}/status`));

  console.log('room id', roomId);

  let pingToast;
  if (incomingPings.length > 0) {
    const incomingPingMap = {};
    for (const p of incomingPings) {
      if (!(p in incomingPingMap)) incomingPingMap[p] = 0;
      incomingPingMap[p] += 1;
    }
    let totalText = '';
    for (const [text, times] of Object.entries(incomingPingMap)) {
      totalText += `${text} ${times > 1 ? `(${times})` : ''}\n`;
    }
    pingToast = <Toast text={totalText} dismiss={() => clearPings()} />;
  } else {
    pingToast = null;
  }

  return (
    <div
      className={`p-2 mx-auto w-full max-w-lg h-full ${
        justPinged ? 'shake' : ''
      }`}
    >
      <Suspense fallback={null}>
        <VisibilityListener
          socket={socket}
          leaveRoom={leaveRoom}
          joinRoom={joinRoom}
          roomId={roomId}
          transitioningRef={transitioningRef}
          clearPings={clearPings}
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

          {pingToast}

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
