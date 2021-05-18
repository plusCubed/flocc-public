import React, { useCallback, useEffect, useState } from 'react';
import {
  useAuth,
  useDatabase,
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
import { Friends, PeopleSearch } from './friends';
import { SectionLabel } from './ui';
import { isDevelopment } from '../util/isDevelopment';
import RoomState from '../../../common/roomState';

const SOCKET_ENDPOINT = isDevelopment
  ? 'http://localhost:3010'
  : 'https://server.flocc.app:8443';

export function Home() {
  const database = useDatabase();
  const user = useUser();
  const { displayName, email, photoURL, uid } = user;

  useEffect(() => {
    database.ref(`users/${uid}/displayName`).set(displayName);
  }, [database, displayName, uid]);

  const [inputDevice, setInputDevice] = useState('');
  const [outputDevice, setOutputDevice] = useState('');

  const { socket, connected } = useSocket(SOCKET_ENDPOINT, user);

  const { roomId, roomState, joinRoom, leaveRoom } = useSocketRoom(
    socket,
    connected
  );

  useEffect(() => {
    const onfocus = function (event) {
      console.log('focus');
      /*if (roomState === RoomState.NONE) {
        joinRoom(null, true).then();
      }*/
    };

    const onblur = function (event) {
      console.log('blur');
    };

    window.addEventListener('focus', onfocus);
    window.addEventListener('blur', onblur);
    return () => {
      window.removeEventListener('focus', onfocus);
      window.removeEventListener('blur', onblur);
    };
  }, [joinRoom, roomState]);

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

  const muteRef = database.ref(`users/${uid}/mute`);
  const mute = useDatabaseObjectData(muteRef);
  const toggleMute = useCallback(() => {
    muteRef.set(!mute).then();
  }, [mute, muteRef]);

  return (
    <div className="w-full h-full p-2 max-w-lg mx-auto">
      {!connected ? (
        <div className="w-full h-full flex items-center justify-center">
          Connecting to server...
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          <div className="font-semibold flex items-center">
            <div>{displayName}</div>
            <button
              className="relative focus:outline-none rounded text-gray-700 hover:bg-gray-200 ml-1 p-1"
              onClick={toggleMute}
            >
              {mute ? (
                <MatMicrophoneOffIcon width={20} height={20} />
              ) : (
                <MatMicrophoneIcon width={20} height={20} />
              )}
            </button>
            <div className="flex-1" />
            <SettingsDropdown
              signOut={signOut}
              inputDevice={inputDevice}
              outputDevice={outputDevice}
              setInputDevice={setInputDevice}
              setOutputDevice={setOutputDevice}
            />
          </div>
          <div className="overflow-y-auto flex-1 flex flex-col">
            <div className="flex-1 mt-2">
              <RoomList
                currentRoomId={roomId}
                currentRoomState={roomState}
                joinRoom={joinRoom}
                leaveRoom={leaveRoom}
                connectionStates={connectionStates}
              />
            </div>

            <div className="mt-6 mb-2 flex-1 flex flex-col">
              <SectionLabel>Friends</SectionLabel>
              <Friends />
              <PeopleSearch />
            </div>
          </div>
          <RoomRtc
            socket={socket}
            inputDevice={inputDevice}
            outputDevice={outputDevice}
            mute={mute}
            onConnectionStatesChange={setConnectionStates}
          />
          {roomId ? <Music currentRoomId={roomId} /> : null}
        </div>
      )}
    </div>
  );
}
