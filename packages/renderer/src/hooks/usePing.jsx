import { useCallback, useEffect, useState } from 'react';

import { useRecoilValue } from 'recoil';

import Icon from '../../assets/icon.png';
import pingedSound from '../../assets/sounds/nudge.mp3';
import { audioOutputAtom } from '../atoms/audioDeviceAtom';
import { electronApi } from '../util/electronApi';
import { playSound } from '../util/playSound';

import { useSocketListener } from './useSocket';

export function usePing(socket, database) {
  const outputDevice = useRecoilValue(audioOutputAtom);
  const ping = useCallback(
    (uid) => {
      if (!socket) return;

      socket.emit('ping', { peerUid: uid });
      playSound(pingedSound, outputDevice);
    },
    [outputDevice, socket]
  );

  const [incomingPings, setIncomingPings] = useState([]);
  const clearPings = () => {
    setIncomingPings((pings) => (pings.length > 0 ? [] : pings));
  };

  const [justPinged, setJustPinged] = useState(false);

  // Only works on desktop for now - web notifications require workers
  const onPinged = useCallback(
    async ({ peerUid, peerSocketId }) => {
      const name = (
        await database.ref(`users/${peerUid}/displayName`).once('value')
      ).val();
      console.log(`pinged by ${name}`);
      const text = `${name} pinged you!`;
      playSound(pingedSound, outputDevice);

      const seen = document.hasFocus();

      let notification = null;
      if (!seen) {
        notification = new Notification(text, {
          icon: Icon,
          silent: true,
        });
        electronApi().sendSync('flash');
      }

      setJustPinged(true);
      setIncomingPings((pings) => {
        return [...pings, text];
      });

      setTimeout(() => {
        if (seen) {
          notification?.close();
          setIncomingPings((pings) => {
            // remove first instance of the text
            const idx = pings.findIndex((p) => p.startsWith(text));
            const newPings = [...pings];
            newPings.splice(idx, 1);
            return newPings;
          });
        }
      }, 5000);
    },
    [database, outputDevice]
  );
  useSocketListener(socket, 'pinged', onPinged);

  useEffect(() => {
    let timeout;
    if (justPinged) {
      timeout = setTimeout(() => {
        setJustPinged(false);
      }, 200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [justPinged]);

  return { ping, incomingPings, clearPings, justPinged };
}
