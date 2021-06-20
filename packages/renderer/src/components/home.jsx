import React, { useCallback, useEffect, useState, Suspense } from 'react';

import { useAuth, useDatabase, useUser } from 'reactfire';
import { useRecoilValue } from 'recoil';

import pingedSound from '../../assets/sounds/nudge.mp3';
import { audioOutputAtom } from '../atoms/audioDeviceAtom';
import { isDevelopment } from '../constants/isDevelopment';
import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { useSocket, useSocketListener } from '../hooks/useSocket';
import { useSocketRoom } from '../hooks/useSocketRoom';
import { useUid } from '../hooks/useUid';
import { electronApi } from '../util/electronApi';
import { playSound } from '../util/playSound';

import { FriendsDropdown } from './friendsDropdown';
import { MatMicrophoneIcon, MatMicrophoneOffIcon } from './icons';
import { HelpPopup } from './infoDropdown';
import { Music } from './music';
import { RoomList } from './roomList';
import { RoomRtc } from './roomRtc';
import { SettingsDropdown } from './settingsDropdown';
import { StatusIndicator } from './statusIndicator';
import { Toast } from './toast';

const LOCAL_SERVER = false;
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
  clearPings,
}) {
  const database = useDatabase();
  const roomUsers = useDatabaseListData(database.ref(`rooms/${roomId}/users`));
  const roomUserCount = roomUsers.length; // reset visibility detection when room user count changes

  useEffect(() => {
    let idleTimeoutId = null;
    let pingTimeoutId = null;
    const onVisible = () => {
      console.log('visible');
      if (!socket) return;

      socket.emit('active');
      if (!roomId && !transitioningRef.current) {
        console.log('joining new room on focus');
        joinRoom(null, false);
      }

      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
      }

      pingTimeoutId = setTimeout(clearPings, 5000);
    };

    const onHidden = async () => {
      console.log('hidden');
      if (!socket) return;

      idleTimeoutId = setTimeout(
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
      if (idleTimeoutId != null) clearTimeout(idleTimeoutId);
      if (pingTimeoutId != null) clearTimeout(pingTimeoutId);
    };
  }, [
    clearPings,
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
  const outputDevice = useRecoilValue(audioOutputAtom);
  const ping = useCallback(
    (uid) => {
      if (!socket) return;

      socket.emit('ping', { peerUid: uid });
      playSound(pingedSound, outputDevice);
    },
    [outputDevice, socket]
  );

  const [incomingPings, setIncomingPings] = useState([]);
  const clearPings = () => {
    setIncomingPings((pings) => (pings.length > 0 ? [] : pings));
  };

  const [justPinged, setJustPinged] = useState(false);

  // Only works on desktop for now - web notifications require workers
  const onPinged = useCallback(
    async ({ peerUid, peerSocketId }) => {
      const name = (
        await database.ref(`users/${peerUid}/displayName`).once('value')
      ).val();
      console.log(`pinged by ${name}`);
      const text = `${name} pinged you!`;
      playSound(pingedSound, outputDevice);

      const seen = !document.hasFocus();

      let notification = null;
      if (!seen) {
        notification = new Notification(text, {
          silent: true,
        });
        electronApi().sendSync('flash');
      }

      setJustPinged(true);
      setIncomingPings((pings) => {
        return [...pings, text];
      });

      setTimeout(() => {
        if (seen) {
          notification?.close();
          setIncomingPings((pings) => {
            // remove first instance of the text
            const idx = pings.findIndex((p) => p.startsWith(text));
            const newPings = [...pings];
            newPings.splice(idx, 1);
            return newPings;
          });
        }
      }, 5000);
    },
    [database, outputDevice]
  );
  useSocketListener(socket, 'pinged', onPinged);

  useEffect(() => {
    let timeout;
    if (justPinged) {
      timeout = setTimeout(() => {
        setJustPinged(false);
      }, 200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [justPinged]);

  return { ping, incomingPings, clearPings, justPinged };
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
  const { ping, incomingPings, clearPings, justPinged } = usePing(
    socket,
    database
  );

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

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
