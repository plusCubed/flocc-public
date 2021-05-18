import { useDatabase, useDatabaseObjectData, useUser } from 'reactfire';
import { useCallback, useEffect } from 'react';
import { usePrevious } from './usePrev';
import RoomState from '../../../common/roomState';

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function useRoomState() {
  const database = useDatabase();
  const uid = useUser().uid;
  const roomStateRef = database.ref(`users/${uid}/roomState`);
  const roomStateObjectData = useDatabaseObjectData(roomStateRef);
  return isString(roomStateObjectData) ? roomStateObjectData : RoomState.NONE;
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
  const roomState = useRoomState();
  const transitioning =
    roomState === RoomState.JOINING || roomState === RoomState.LEAVING;

  const roomStateRef = database.ref(`users/${uid}/roomState`);

  const joinRoom = useCallback(
    async (id, locked) => {
      if (!socket) return;
      if (transitioning) return;
      if (id === roomId) return; // already in this room

      // create room if id is null
      console.info('Joining room', id);
      roomStateRef.set(RoomState.JOINING);
      socket.emit('join', { room: id, locked });
    },
    [roomId, roomStateRef, socket, transitioning]
  );

  const leaveRoom = useCallback(async () => {
    if (transitioning) return;

    // assume connected
    console.info('Leaving room', roomId);
    roomStateRef.set(RoomState.LEAVING);
    socket?.emit('leave');
  }, [transitioning, roomId, roomStateRef, socket]);

  const prevConnected = usePrevious(connected);
  useEffect(() => {
    if (!socket) return;

    // resume connection to room after losing connection
    if (!prevConnected && connected && roomId) {
      socket.emit('join', { room: roomId });
    }
  }, [connected, database, prevConnected, roomId, socket, uid]);

  const prevRoomState = usePrevious(roomState);
  useEffect(() => {
    if (roomState === RoomState.NONE && socket) {
      joinRoom(null, prevRoomState === RoomState.NONE);
    }
  }, [joinRoom, prevRoomState, roomState, socket, uid]);

  return { roomId, roomState, joinRoom, leaveRoom };
}
