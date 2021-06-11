import React, { useCallback } from 'react';

import isElectron from 'is-electron';
import { useAuth } from 'reactfire';

import Icon from '../../assets/icon.png';

import { Button } from './ui';
import { electronApi } from '../util/electronApi';

export function SignInForm() {
  const auth = useAuth();
  const GoogleAuthProvider = useAuth.GoogleAuthProvider;

  const signIn = useCallback(async () => {
    if (isElectron()) {
      electronApi().send('sign-in-with-google');
      electronApi().once(
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
    } else {
      const provider = new GoogleAuthProvider();
      await auth.signInWithRedirect(provider);
    }
  }, [auth, GoogleAuthProvider]);

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <img src={Icon} alt="Flocc Icon" className="w-12 mb-2" />
      <Button onClick={signIn} className="py-2 px-4">
        Sign in with Google
      </Button>
    </div>
  );
}
