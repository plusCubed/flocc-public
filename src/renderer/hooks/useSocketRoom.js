import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';

import { usePrevious } from './usePrevious';

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function useRoomId() {
  const database = useDatabase();
  const uid = useUser().uid;
  const userRoomRef = database.ref(`users/${uid}/room`);
  const roomIdObjectData = useDatabaseObjectData(userRoomRef);
  return isString(roomIdObjectData) ? roomIdObjectData : '';
}

export function useSocketRoom(socket, connected) {
  const database = useDatabase();
  const uid = useUser().uid;

  const roomId = useRoomId();

  const transitioningRef = useRef(false);

  // Return true if joined successfully
  const joinRoom = useCallback(
    async (id, locked) => {
      if (!socket) return false;
      if (transitioningRef.current) return false;
      if (id && id === roomId) return false; // already in this room
      console.log(id, roomId);

      transitioningRef.current = true;

      // create room if id is null
      console.info('Joining room', id);
      socket.emit('join', { room: id, locked });
      socket.once('joined', () => {
        transitioningRef.current = false;
      });

      return true;
    },
    [roomId, socket]
  );

  // Return true if left successfully
  const leaveRoom = useCallback(async () => {
    if (!socket) return false;
    if (transitioningRef.current) return false;

    transitioningRef.current = true;

    console.info('Leaving room', roomId);
    socket.emit('leave');
    socket.once('left', () => {
      transitioningRef.current = false;
    });

    return true;
  }, [roomId, socket]);

  const prevConnected = usePrevious(connected);
  useEffect(() => {
    if (!socket) return;
    if (transitioningRef.current) return;

    // resume connection to room after losing connection
    if (!prevConnected && connected && roomId) {
      console.log('reconnecting to room', roomId);

      transitioningRef.current = true;
      socket.emit('join', { room: roomId });
      socket.once('joined', () => {
        transitioningRef.current = false;
      });
    }
  }, [connected, database, prevConnected, roomId, socket, uid]);

  return {
    roomId,
    joinRoom,
    leaveRoom,
    transitioning: transitioningRef.current,
  };
}
