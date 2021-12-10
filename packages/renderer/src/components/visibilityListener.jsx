import React, { useEffect } from 'react';

import { captureException } from '@sentry/electron/esm/renderer';
import { useDatabase } from 'reactfire';

import { isDevelopment } from '../constants/isDevelopment';
import { useDatabaseListData } from '../hooks/useDatabase';

export function VisibilityListener({
  socket,
  roomId,
  transitioningRef,
  joinRoom,
  leaveRoom,
  clearPings,
}) {
  //const database = useDatabase();
  //const roomUsers = useDatabaseListData(database.ref(`rooms/${roomId}/users`));
  //const roomUserCount = roomUsers.length; // reset visibility detection when room user count changes

  useEffect(() => {
    let idleTimeoutId = null;
    let pingTimeoutId = null;
    const onVisible = () => {
      console.log('visible');
      if (!socket) return;

      socket.emit('active');
      if (!roomId && !transitioningRef.current) {
        console.log('joining new room on focus');
        joinRoom(null, false);
      }

      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
      }

      pingTimeoutId = setTimeout(clearPings, 5000);
    };

    const onHidden = async () => {
      console.log('hidden');
      if (!socket) return;

      idleTimeoutId = setTimeout(
        async () => {
          // only user in a room => idle
          if (roomUserCount <= 1) {
            console.log('idle');
            socket.emit('idle');
            if (roomUserCount === 1) {
              leaveRoom().catch((e) => {
                console.error(e);
                captureException(e);
              });
            }
          } else {
            console.log('not idling: more than 1 person in room');
          }
        },
        isDevelopment ? 10 * 1000 : 5 * 60 * 1000
      ); // 5 min
    };

    const handleVisibilityChange = () => {
      if (document['hidden']) {
        onHidden();
      } else {
        onVisible();
      }
    };

    // do initial detection
    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimeoutId != null) clearTimeout(idleTimeoutId);
      if (pingTimeoutId != null) clearTimeout(pingTimeoutId);
    };
  }, [
    clearPings,
    database,
    joinRoom,
    leaveRoom,
    roomId,
    roomUserCount,
    socket,
    transitioningRef,
  ]);
  return <></>;
}
