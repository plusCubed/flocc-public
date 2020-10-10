import React, { Suspense, useEffect } from 'react';
import {
  AuthCheck,
  FirebaseAppProvider,
  preloadFirestore,
  preloadDatabase,
  useAuth,
} from 'reactfire';
import isElectron from 'is-electron';

import firebaseConfig from './config/firebaseConfig';
import { SignInForm } from './signin';
import { Home } from './home';
import { ErrorBoundary } from './error';

function ScreenCenter({ children }) {
  return (
    <div className="h-screen flex items-center justify-center">{children}</div>
  );
}

const isDevelopment =
  (isElectron() && require('electron-is-dev')) ||
  (!isElectron() && window.location.hostname === 'localhost');

/*if (isDevelopment) {
  firebaseConfig.databaseURL = 'http://localhost:9000/?ns=floccapp';
}*/
function App() {
  preloadDatabase();

  const auth = useAuth();
  useEffect(() => {
    if (!isElectron()) {
      auth
        .getRedirectResult()
        .then((user) =>
          console.info('Attempted sign in by redirect', user.user)
        )
        .catch((e) => {
          console.error('Sign in by redirect error', e);
        });
    }
  }, [auth]);
  return (
    <AuthCheck fallback={<SignInForm />}>
      <Home />
    </AuthCheck>
  );
}

export function AppWrapper() {
  return (
    <ErrorBoundary fallback={<ScreenCenter>An error occurred</ScreenCenter>}>
      <FirebaseAppProvider firebaseConfig={firebaseConfig}>
        <Suspense fallback={<ScreenCenter>Loading...</ScreenCenter>}>
          <App />
        </Suspense>
      </FirebaseAppProvider>
    </ErrorBoundary>
  );
}
