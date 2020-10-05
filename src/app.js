import {
  AuthCheck,
  FirebaseAppProvider,
  preloadFirestore,
  useAuth,
} from 'reactfire';
import firebaseConfig from './config/firebaseConfig';
import React, { Suspense, useEffect } from 'react';
import isElectron from 'is-electron';
import { SignInForm } from './signin';
import { Home } from './home';

const electron = isElectron();

function Loading() {
  return (
    <div className="h-screen flex items-center justify-center">Loading...</div>
  );
}

function App() {
  preloadFirestore({
    setup: (firestore) => {
      if (
        (electron && require('electron-is-dev')) ||
        (!electron && window.location.hostname === 'localhost')
      ) {
        firestore().settings({
          host: 'localhost:8080',
          ssl: false,
        });
      }
    },
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

export function AppWrapper() {
  return (
    <FirebaseAppProvider firebaseConfig={firebaseConfig}>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </FirebaseAppProvider>
  );
}
