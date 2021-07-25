import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { init } from '@sentry/electron/esm/renderer';
import isElectron from 'is-electron';
import {
  AuthCheck,
  FirebaseAppProvider,
  useAuth,
  useDatabase,
  useUser,
} from 'reactfire';
import { RecoilRoot } from 'recoil';
import { createClient, Provider as UrqlProvider } from 'urql';

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
  return (
    <AuthCheck fallback={<SignInForm />}>
      <HasuraProvider fallback={<ScreenCenter>Loading Hasura...</ScreenCenter>}>
        <Home />
      </HasuraProvider>
    </AuthCheck>
  );
}

function useUrqlClient(token) {
  return useMemo(() => {
    return createClient({
      url: 'https://floccapp.hasura.app/v1/graphql',
      fetchOptions: () => {
        return {
          headers: { authorization: token ? `Bearer ${token}` : '' },
        };
      },
      suspense: true,
    });
  }, [token]);
}

function HasuraProvider({ fallback, children }) {
  const [token, setToken] = useState('');

  const auth = useAuth();
  const database = useDatabase();
  const user = useUser().data;
  useEffect(() => {
    async function updateToken() {
      const token = await user.getIdToken();
      const idTokenResult = await user.getIdTokenResult();
      const hasuraClaim = idTokenResult.claims['https://hasura.io/jwt/claims'];

      if (hasuraClaim) {
        setToken(token);
      } else {
        // Check if refresh is required.
        const metadataRef = database.ref(
          'metadata/' + user.uid + '/refreshTime'
        );

        metadataRef.on('value', async (data) => {
          if (!data.exists) return;
          // Force refresh to pick up the latest custom claims changes.
          const token = await user.getIdToken(true);
          setToken(token);
        });
      }

      console.log(token);
    }
    updateToken().catch((e) => console.error(e));
  }, [auth, database, user]);

  const client = useUrqlClient(token);

  return (
    <Suspense fallback={fallback}>
      <UrqlProvider value={client}>{children}</UrqlProvider>
    </Suspense>
  );
}

export function AppWrapper() {
  return (
    <ErrorBoundary fallback={<ScreenCenter>An error occurred</ScreenCenter>}>
      <FirebaseAppProvider firebaseConfig={firebaseConfig} suspense={true}>
        <RecoilRoot>
          <Suspense fallback={<ScreenCenter>Loading app...</ScreenCenter>}>
            <App />
          </Suspense>
        </RecoilRoot>
      </FirebaseAppProvider>
    </ErrorBoundary>
  );
}
