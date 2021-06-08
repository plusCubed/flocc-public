import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrevious } from './usePrev';

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

  const joinRoom = useCallback(
    async (id, locked) => {
      if (!socket) return;
      if (transitioningRef.current) return;
      if (id && id === roomId) return; // already in this room

      transitioningRef.current = true;

      // create room if id is null
      console.info('Joining room', id);
      socket.emit('join', { room: id, locked });
      socket.once('joined', () => {
        transitioningRef.current = false;
      });
    },
    [roomId, socket]
  );

  /*const call = useCallback(
    (peerUid) => {
      if (!socket) return;
      console.info('Calling', peerUid);
      socket.emit('call', { peerUid });
    },
    [socket]
  );
*/
  const leaveRoom = useCallback(async () => {
    if (!socket) return;
    if (transitioningRef.current) return;

    transitioningRef.current = true;

    console.info('Leaving room', roomId);
    socket.emit('leave');
    socket.once('left', () => {
      transitioningRef.current = false;
    });
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

  /*const prevRoomState = usePrevious(roomState);
  useEffect(() => {
    if (roomState === RoomState.NONE && socket) {
      joinRoom(null, false);
    }
  }, [joinRoom, prevRoomState, roomState, socket, uid]);*/

  return {
    roomId,
    joinRoom,
    leaveRoom,
    transitioningRef,
  };
}
