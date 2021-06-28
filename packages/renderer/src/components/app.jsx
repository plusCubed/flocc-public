import React, { Suspense, useEffect, useState } from 'react';

import { init } from '@sentry/electron/esm/renderer';
import isElectron from 'is-electron';
import {
  AuthCheck,
  FirebaseAppProvider,
  useAuth,
  useDatabase,
} from 'reactfire';
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
  return <Auth fallback={<SignInForm />}></Auth>;
}

function Auth({ fallback }) {
  const [authState, setAuthState] = useState({ status: 'loading' });

  const auth = useAuth();
  const database = useDatabase();
  useEffect(() => {
    return auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();
        const idTokenResult = await user.getIdTokenResult();
        const hasuraClaim =
          idTokenResult.claims['https://hasura.io/jwt/claims'];

        if (hasuraClaim) {
          setAuthState({ status: 'in', user, token });
        } else {
          // Check if refresh is required.
          const metadataRef = database.ref(
            'metadata/' + user.uid + '/refreshTime'
          );

          metadataRef.on('value', async (data) => {
            if (!data.exists) return;
            // Force refresh to pick up the latest custom claims changes.
            const token = await user.getIdToken(true);
            setAuthState({ status: 'in', user, token });
          });
        }
      } else {
        setAuthState({ status: 'out' });
      }
    });
  }, [auth, database]);

  const signOut = async () => {
    try {
      setAuthState({ status: 'loading' });
      await auth.signOut();
      setAuthState({ status: 'out' });
    } catch (error) {
      console.log(error);
    }
  };

  let content;
  if (authState.status === 'loading') {
    content = null;
  } else {
    content = (
      <>
        {authState.status === 'in' ? <Home /> : fallback}
        <App authState={authState} authSignOut={signOut} />
      </>
    );
  }

  return <div className="auth">{content}</div>;
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
