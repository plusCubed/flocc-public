import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth, useDatabase, useUser } from 'reactfire';
import isElectron from 'is-electron';

import { RoomAudio, RoomSelector, RoomState } from './talk';
import { useSocket, useSocketListener } from './socket-hooks';
import { AudioSelector } from './audioselect';
import { Button, MicrophoneIcon, SpeakerIcon } from './ui';

const isDevelopment =
  (isElectron() && require('electron-is-dev')) ||
  (!isElectron() && window.location.hostname === 'localhost');

const SOCKET_ENDPOINT = isDevelopment
  ? 'http://localhost:3010'
  : 'https://server.flocc.app:8443';

function openUserMedia(device) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device,
    },
  });
}

function ServerDisconnnected() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      Connecting to server...
    </div>
  );
}

function useDeviceStream(inputDevice) {
  const [stream, setStream] = useState(null);
  useEffect(() => {
    openUserMedia(inputDevice)
      .then((stream) => {
        console.log('Device stream opened');
        setStream(stream);
      })
      .catch((e) => {
        console.error('Mic stream error', e);
        alert(e);
      });
  }, [inputDevice]);
  return stream;
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

  const joinRoom = async (id) => {
    console.info('Joining room', roomId);
    setRoomId(id);
    setRoomState(RoomState.JOINING);
    await database.ref(`rooms/${id}/users/${uid}`).set(true);
  };
  const leaveRoom = useCallback(async () => {
    console.info('Leaving room', roomId);
    setRoomId('');
    setRoomState(RoomState.LEAVING);
    await database.ref(`rooms/${roomId}/users/${uid}`).remove();
  }, [roomId, database, uid]);
  return { roomId, roomState, joinRoom, leaveRoom };
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

  const micStream = useDeviceStream(inputDevice);

  const auth = useAuth();
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  const [connectionStateByUid, setConnectionStateByUid] = useState({});

  return (
    <div className="w-full h-full p-2 max-w-lg mx-auto">
      {!connected ? (
        <ServerDisconnnected />
      ) : (
        <>
          <div className="font-medium flex items-center pb-2">
            <div className="flex-1">{displayName}</div>
            <Button onClick={signOut}>Sign out</Button>
          </div>
          <AudioSelector
            kind="audioinput"
            icon={<MicrophoneIcon className="w-4 h-4 mr-1" />}
            onDeviceChange={setInputDevice}
          />
          <AudioSelector
            kind="audiooutput"
            icon={<SpeakerIcon className="w-4 h-4 mr-1" />}
            onDeviceChange={setOutputDevice}
          />
          {micStream ? (
            <Suspense fallback={<div>Connecting...</div>}>
              <RoomAudio
                socket={socket}
                micStream={micStream}
                outputDevice={outputDevice}
                onConnectionStateChange={setConnectionStateByUid}
              />
            </Suspense>
          ) : (
            <div>Loading microphone...</div>
          )}
          <RoomSelector
            currentRoomId={roomId}
            currentRoomState={roomState}
            joinRoom={joinRoom}
            leaveRoom={leaveRoom}
            connectionStateByUid={connectionStateByUid}
          />
        </>
      )}
    </div>
  );
}
