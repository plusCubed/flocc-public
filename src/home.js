import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth, useFirestore, useUser } from 'reactfire';
import { RoomAudio, RoomSelector, RoomState } from './talk';
import { useSocket, useSocketListener } from './socket-hooks';
import { AudioSelector } from './audioselect';
import { Button, MicrophoneIcon, SpeakerIcon } from './ui';

const SOCKET_ENDPOINT =
  window.location.hostname === 'localhost' ? 'http://localhost:3010' : '';

function openUserMedia(device) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device,
    },
  });
}

export function Home() {
  const firestore = useFirestore();
  const user = useUser();
  const { displayName, email, photoURL, uid } = user;

  useEffect(() => {
    firestore.doc(`users/${uid}`).set({ displayName }, { merge: true });
  }, [displayName, firestore, uid]);

  const [inputDevice, setInputDevice] = useState('');
  const [outputDevice, setOutputDevice] = useState('');

  const [currentRoom, setCurrentRoom] = useState({
    id: '',
    state: RoomState.NONE,
  });

  const [socket, connected] = useSocket(SOCKET_ENDPOINT, user);
  useEffect(() => {
    if (!socket || !connected) return;

    if (currentRoom.id) {
      console.info('Joining room', currentRoom.id);
      socket.emit('join', { room: currentRoom.id });
    } else {
      socket.emit('leave');
    }
  }, [connected, currentRoom.id, socket]);

  const handleJoined = useCallback(({ room }) => {
    setCurrentRoom({ id: room, state: RoomState.JOINED });
    console.log('JOINED');
  }, []);
  useSocketListener(socket, 'joined', handleJoined);

  const handleLeft = useCallback(() => {
    setCurrentRoom({ id: '', state: RoomState.NONE });
    console.log('LEFT');
  }, []);
  useSocketListener(socket, 'left', handleLeft);

  const [micStream, setMicStream] = useState(null);
  useEffect(() => {
    openUserMedia(inputDevice)
      .then((stream) => {
        console.log('Mic stream opened');
        setMicStream(stream);
      })
      .catch((e) => {
        console.error('Mic stream error', e);
        alert(e);
      });
  }, [inputDevice]);

  const auth = useAuth();
  const leaveRoom = useCallback(async () => {
    setCurrentRoom({ id: '', state: RoomState.LEAVING });
    await firestore.doc(`rooms/${currentRoom.id}/users/${uid}`).delete();
  }, [currentRoom.id, firestore, uid]);
  const signOut = useCallback(async () => {
    await leaveRoom();
    await auth.signOut();
  }, [auth, leaveRoom]);

  return (
    <div>
      <div className="font-medium p-2">{displayName}</div>
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
      {!micStream ? <div>Loading microphone...</div> : null}
      {currentRoom.state === RoomState.JOINED && micStream ? (
        <Suspense fallback={null}>
          <RoomAudio
            socket={socket}
            connected={connected}
            currentRoom={currentRoom.id}
            micStream={micStream}
            outputDevice={outputDevice}
          />
        </Suspense>
      ) : null}
      <RoomSelector
        currentRoom={currentRoom}
        setCurrentRoom={setCurrentRoom}
        leaveRoom={leaveRoom}
      />
      <Button onClick={signOut}>Sign out</Button>
    </div>
  );
}
