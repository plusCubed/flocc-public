import React, { Suspense, useEffect } from 'react';

import { init } from '@sentry/electron/dist/renderer';
import isElectron from 'is-electron';
import { AuthCheck, FirebaseAppProvider, useAuth } from 'reactfire';
import { RecoilRoot } from 'recoil';

import firebaseConfig from '../secrets/firebaseConfig';

import { ErrorBoundary } from './errorBoundary';
import { Home } from './home';
import { SignInForm } from './signin';

function ScreenCenter({ children }) {
  return (
    <div className="h-screen flex items-center justify-center">{children}</div>
  );
}

init({
  dsn: 'https://817efb9fe22b4900ad01c6a9cd2a17cf@o604937.ingest.sentry.io/5744711',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
});

/*if (isDevelopment) {
  firebaseConfig.databaseURL = 'http://localhost:9000/?ns=floccapp';
}*/
function App() {
  // preloadDatabase();

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
      <FirebaseAppProvider firebaseConfig={firebaseConfig} suspense={true}>
        <RecoilRoot>
          <Suspense fallback={<ScreenCenter>Loading...</ScreenCenter>}>
            <App />
          </Suspense>
        </RecoilRoot>
      </FirebaseAppProvider>
    </ErrorBoundary>
  );
}
