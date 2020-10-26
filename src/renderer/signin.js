import { useAuth } from 'reactfire';
import React, { useCallback } from 'react';
import isElectron from 'is-electron';
/*import googleOAuthConfig from '../main/config/googleOAuthConfig';

let electronOAuth = null;
if (isElectron()) {
  const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2')
    .default;
  electronOAuth = new ElectronGoogleOAuth2(
    googleOAuthConfig.clientId,
    googleOAuthConfig.clientSecret,
    [],
    {
      // TODO: Change
      successRedirectURL: 'https://flocc.app/oauth',
    }
  );
}*/

export function SignInForm() {
  const auth = useAuth();
  const GoogleAuthProvider = useAuth.GoogleAuthProvider;

  const signIn = useCallback(async () => {
    if (isElectron()) {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('sign-in-with-google');
      ipcRenderer.once(
        'sign-in-with-google-response',
        async (event, error, token) => {
          if (!error) {
            await auth.signInWithCredential(
              GoogleAuthProvider.credential(null, token.access_token)
            );
          } else {
            console.error('Sign in error');
          }
        }
      );
      /*const token = await electronOAuth.openAuthWindowAndGetTokens();
      await auth.signInWithCredential(
        GoogleAuthProvider.credential(null, token.access_token)
      );*/
    } else {
      const provider = new GoogleAuthProvider();
      await auth.signInWithRedirect(provider);
    }
  }, [auth, GoogleAuthProvider]);

  return (
    <div className="h-screen flex items-center justify-center">
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={signIn}
      >
        Sign in with Google
      </button>
    </div>
  );
}
