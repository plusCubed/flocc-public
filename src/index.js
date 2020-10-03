import React, { Suspense, useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  AuthCheck,
  FirebaseAppProvider, preloadFirestore,
  useAuth,
  useFirestore,
  useFirestoreDocData,
  useUser
} from 'reactfire';

import './index.css';
import firebaseConfig from './config/firebaseConfig';
import { RoomAudio, RoomSelector } from './talk';
import { MicrophoneIcon, SpeakerIcon } from './components';
import { SignInForm } from './signin';
import { AudioSelector } from './audioselect';

function Loading() {
  return (
    <div className="h-screen flex items-center justify-center">Loading...</div>
  );
}

function openUserMedia(device) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device,
    },
  });
}

function Home() {
  const firestore = useFirestore();
  const user = useUser();
  const { displayName, email, photoURL, uid } = user;

  useEffect(() => {
    firestore.doc(`users/${uid}`).set({ displayName }, { merge: true });
  });

  const [inputDevice, setInputDevice] = useState('');
  const [outputDevice, setOutputDevice] = useState('');

  const { room: currentRoomId } = useFirestoreDocData(
    firestore.collection('users').doc(useUser().uid)
  );

  const [micStream, setMicStream] = useState(null);
  useEffect(() => {
    openUserMedia(inputDevice).then(setMicStream);
  }, [inputDevice]);

  const auth = useAuth();
  const signOut = useCallback(() => {
    firestore.doc(`users/${uid}`).set({ room: '' }, { merge: true });
    auth.signOut();
  }, [auth, firestore, uid]);

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
      {currentRoomId && micStream ? (
        <Suspense fallback={null}>
          <RoomAudio
            roomId={currentRoomId}
            micStream={micStream}
            outputDevice={outputDevice}
          />
        </Suspense>
      ) : null}
      <RoomSelector />
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={signOut}
      >
        Sign out
      </button>
    </div>
  );
}

function App() {
  preloadFirestore({
    setup: firestore => firestore().settings({
      host: "localhost:8080",
      ssl: false
    })
  });

  const auth = useAuth();
  useEffect(() => {
    auth
      .getRedirectResult()
      .then((user) => console.info('Attempted sign in by redirect', user.user))
      .catch((e) => {
        console.error('Sign in by redirect error', e);
      });
  }, [auth]);
  return (
    <AuthCheck fallback={<SignInForm />}>
      <Home />
    </AuthCheck>
  );
}

function AppWrapper() {
  return (
    <FirebaseAppProvider firebaseConfig={firebaseConfig}>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </FirebaseAppProvider>
  );
}

ReactDOM.unstable_createRoot(document.getElementById('root')).render(
  <AppWrapper />
);
