import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, useDatabase, useUser } from 'reactfire';
import isElectron from 'is-electron';
import { Transition } from '@headlessui/react';

import { RoomState, RoomRtc } from './roomRtc';
import { useSocket, useSocketListener } from '../util/socketHooks';
import { AudioSelector } from './audioSelect';
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
import { getOSMicPermissionGranted } from '../util/micPermission';
import birds from '../util/birds';
import { usePrevious } from '../util/usePrev';

const isDevelopment =
  (isElectron() && require('electron').ipcRenderer.sendSync('is-dev')) ||
  (!isElectron() && window.location.hostname === 'localhost');

const SOCKET_ENDPOINT = isDevelopment
  ? 'http://localhost:3010'
  : 'https://server.flocc.app:8443';

function ServerDisconnnected() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      Connecting to server...
    </div>
  );
}

function getAudioInputStream(device) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device,
    },
  });
}

async function checkPermissionAndGetMicStream(inputDevice) {
  const granted = await getOSMicPermissionGranted();
  if (!granted) {
    throw new Error('Microphone permission is required to talk to friends');
  }
  const micStream = await getAudioInputStream(inputDevice);
  if (!micStream) {
    throw new Error('Microphone permission is required to talk to friends');
  }
  console.info('Mic stream obtained');
  return micStream;
}

function useSocketRoom(socket, connected, inputDevice) {
  const database = useDatabase();
  const uid = useUser().uid;

  // TODO: Use reducer (an actual state machine can you imagine)
  const [roomId, setRoomId] = useState('');
  const [roomState, setRoomState] = useState(RoomState.NONE);

  const handleJoined = useCallback(({ room }) => {
    console.log(`socket: joined ${room}`);
    setRoomId(room);
    setRoomState(RoomState.JOINED);
  }, []);
  useSocketListener(socket, 'joined', handleJoined);

  const [micStream, setMicStream] = useState(null);

  const handleLeft = useCallback(() => {
    console.log('socket: left');
    setRoomId('');
    setRoomState(RoomState.NONE);
  }, []);
  useSocketListener(socket, 'left', handleLeft);

  const transitioning =
    roomState === RoomState.JOINING || roomState === RoomState.LEAVING;

  const leaveRoom = useCallback(async () => {
    if (transitioning) return;
    if (roomState !== RoomState.JOINED) return; // Not in a room

    // assume connected
    console.info('Leaving room', roomId);
    setRoomId('');
    setRoomState(RoomState.LEAVING);
    database.ref(`rooms/${roomId}/users/${uid}`).remove().then();
    socket.emit('leave');
  }, [transitioning, roomState, roomId, database, uid, socket]);

  const joinRoom = useCallback(
    async (id) => {
      if (transitioning) return;
      if (id === roomId) return; // already in this room
      if (roomState === RoomState.JOINED) await leaveRoom();

      // create room if id is null
      if (!id) {
        const roomRef = database
          .ref(`rooms`)
          .push({ name: birds[Math.floor(Math.random() * birds.length)] });
        id = roomRef.key;
      }
      console.info('Joining room', id);
      setRoomId(id);
      setRoomState(RoomState.JOINING);
      database.ref(`rooms/${id}/users/${uid}`).set({ mute: false }).then();
      socket.emit('join', { room: id });
    },
    [database, leaveRoom, roomId, roomState, socket, transitioning, uid]
  );

  const prevConnected = usePrevious(connected);
  useEffect(() => {
    if (!socket) return;

    // resume connection to room after losing connection
    if (!prevConnected && connected && roomId) {
      joinRoom(roomId).then();
    }
  }, [connected, joinRoom, prevConnected, roomId, socket]);

  useEffect(() => {
    let didCancel = false;

    if (roomState === RoomState.JOINED) {
      (async () => {
        try {
          const newStream = await checkPermissionAndGetMicStream(inputDevice);
          if (!didCancel) {
            setMicStream(newStream);
          }
        } catch (e) {
          alert(e.message);
        }
      })();
    } else {
      setMicStream((micStream) => {
        if (micStream) {
          for (const track of micStream.getTracks()) {
            track.stop();
          }
        }
        return null;
      });
    }
    return () => {
      didCancel = true;
    };
  }, [inputDevice, roomState]);

  return { roomId, roomState, joinRoom, leaveRoom, micStream };
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
        <div className="absolute right-0 w-64 mt-2 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg outline-none p-2">
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
          <div className="flex flex-row align-baseline  mt-1">
            <Button onClick={signOut} className="text-sm">
              Sign out
            </Button>
            <div className="flex-1" />
            {isElectron() ? (
              <div>v{require('electron').remote.app.getVersion()}</div>
            ) : null}
          </div>
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

  const { roomId, roomState, joinRoom, leaveRoom, micStream } = useSocketRoom(
    socket,
    connected,
    inputDevice
  );

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStates, setConnectionStates] = useState({});

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
          <div className="overflow-y-auto flex-1">
            <RoomSelector
              currentRoomId={roomId}
              currentRoomState={roomState}
              joinRoom={joinRoom}
              leaveRoom={leaveRoom}
              connectionStates={connectionStates}
            />
          </div>
          <RoomRtc
            socket={socket}
            outputDevice={outputDevice}
            mute={mute}
            onConnectionStatesChange={setConnectionStates}
            micStream={micStream}
          />
          {roomId && isDevelopment ? <Music currentRoomId={roomId} /> : null}
        </div>
      )}
    </div>
  );
}
