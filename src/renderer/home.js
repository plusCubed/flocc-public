import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth, useDatabase, useUser } from 'reactfire';
import isElectron from 'is-electron';
import { Transition } from '@headlessui/react';

import { RoomAudioWrapper, RoomState } from './roomAudio';
import { useSocket, useSocketListener } from './socketHooks';
import { AudioSelector } from './audioselect';
import {
  Button,
  MatMicrophoneIcon,
  MatMicrophoneOffIcon,
  MicrophoneIcon,
  SettingsIcon,
  SpeakerIcon,
} from './ui';
import { RoomSelector } from './roomSelector';
import { Music } from './music';

const isDevelopment =
  (isElectron() && require('electron').ipcRenderer.sendSync('is-dev')) ||
  (!isElectron() && window.location.hostname === 'localhost');

const SOCKET_ENDPOINT =
  /*isDevelopment
  ? 'http://localhost:3010'
  :*/ 'https://server.flocc.app:8443';

function ServerDisconnnected() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      Connecting to server...
    </div>
  );
}

function useSocketRoom(socket, connected) {
  const database = useDatabase();
  const uid = useUser().uid;

  const [roomId, setRoomId] = useState('');
  const [roomState, setRoomState] = useState(RoomState.NONE);
  useEffect(() => {
    if (!socket || !connected) return;

    if (roomId) {
      socket.emit('join', { room: roomId });
    } else {
      socket.emit('leave');
    }
  }, [connected, roomId, socket]);

  const handleJoined = useCallback(({ room }) => {
    setRoomId(room);
    setRoomState(RoomState.JOINED);
    console.log('JOINED');
  }, []);
  useSocketListener(socket, 'joined', handleJoined);

  const handleLeft = useCallback(() => {
    setRoomId('');
    setRoomState(RoomState.NONE);
    console.log('LEFT');
  }, []);
  useSocketListener(socket, 'left', handleLeft);

  const joinRoom = useCallback(
    async (id) => {
      console.info('Joining room', roomId);
      setRoomId(id);
      setRoomState(RoomState.JOINING);
      await database.ref(`rooms/${id}/users/${uid}`).set({ mute: false });
    },
    [database, roomId, uid]
  );
  const leaveRoom = useCallback(async () => {
    console.info('Leaving room', roomId);
    setRoomId('');
    setRoomState(RoomState.LEAVING);
    await database.ref(`rooms/${roomId}/users/${uid}`).remove();
  }, [roomId, database, uid]);
  return { roomId, roomState, joinRoom, leaveRoom };
}

function SettingsDropdown({
  signOut,
  inputDevice,
  outputDevice,
  setInputDevice,
  setOutputDevice,
}) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((open) => !open);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <div className="relative">
      <Transition
        show={open}
        enter="transition duration-100 ease-out"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          className="fixed bg-overlay left-0 top-0 w-screen h-screen z-0"
          onClick={close}
        />
      </Transition>
      <button
        className={
          'relative focus:outline-none rounded text-gray-700 ml-1 p-1 ' +
          (open ? 'bg-gray-400' : 'hover:bg-gray-200')
        }
        onClick={toggle}
      >
        <SettingsIcon className="z-10" width={20} height={20} />
      </button>
      <Transition
        show={open}
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg outline-none p-2">
          <AudioSelector
            kind="audioinput"
            icon={<MicrophoneIcon className="w-4 h-4 mr-1" />}
            device={inputDevice}
            onDeviceChange={setInputDevice}
          />
          <AudioSelector
            kind="audiooutput"
            icon={<SpeakerIcon className="w-4 h-4 mr-1" />}
            device={outputDevice}
            onDeviceChange={setOutputDevice}
          />
          <Button onClick={signOut} className="text-sm">
            Sign out
          </Button>
        </div>
      </Transition>
    </div>
  );
}

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

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStateByUid, setConnectionStateByUid] = useState({});

  const [mute, setMute] = useState(false);
  const toggleMute = useCallback(() => {
    setMute((mute) => !mute);
  }, []);
  useEffect(() => {
    if (roomId) {
      database.ref(`rooms/${roomId}/users/${uid}/mute`).set(mute);
    }
  }, [database, mute, roomId, uid]);

  return (
    <div className="w-full h-full p-2 max-w-lg mx-auto">
      {!connected ? (
        <ServerDisconnnected />
      ) : (
        <div className="w-full h-full flex flex-col">
          <div className="font-medium flex items-center">
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
          <Suspense fallback={<div>Connecting...</div>}>
            <RoomAudioWrapper
              socket={socket}
              inputDevice={inputDevice}
              outputDevice={outputDevice}
              mute={mute}
              onConnectionStateChange={setConnectionStateByUid}
            />
          </Suspense>
          <div className="overflow-y-auto flex-1">
            <RoomSelector
              currentRoomId={roomId}
              currentRoomState={roomState}
              joinRoom={joinRoom}
              leaveRoom={leaveRoom}
              connectionStateByUid={connectionStateByUid}
            />
          </div>
          {roomId && isDevelopment ? <Music /> : null}
        </div>
      )}
    </div>
  );
}
