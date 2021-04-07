import { useDatabase, useUser } from 'reactfire';
import { useCallback, useEffect, useState } from 'react';
import { RoomState } from '../components/roomRtc';
import { useSocketListener } from './useSocket';
import { usePrevious } from './usePrev';

export function useSocketRoom(socket, connected) {
  const database = useDatabase();
  const uid = useUser().uid;

  // TODO: Use reducer (an actual state machine can you imagine)
  const [roomId, setRoomId] = useState('');
  const [roomState, setRoomState] = useState(RoomState.NONE);

  const transitioning =
    roomState === RoomState.JOINING || roomState === RoomState.LEAVING;

  const joinRoom = useCallback(
    async (id, locked) => {
      if (!socket) return;
      if (transitioning) return;
      if (id === roomId) return; // already in this room

      // create room if id is null
      if (!id) {
        const roomRef = database.ref(`rooms`).push({ locked: !!locked });
        id = roomRef.key;
      }
      console.info('Joining room', id);
      setRoomId(id);
      setRoomState(RoomState.JOINING);
      database.ref(`rooms/${id}/users/${uid}`).set({ mute: false }).then();
      socket.emit('join', { room: id });
    },
    [database, roomId, socket, transitioning, uid]
  );

  const leaveRoom = useCallback(async () => {
    if (transitioning) return;

    // assume connected
    console.info('Leaving room', roomId);
    setRoomId('');
    setRoomState(RoomState.LEAVING);
    database.ref(`rooms/${roomId}/users/${uid}`).remove().then();
    socket?.emit('leave');
  }, [transitioning, roomId, database, uid, socket]);

  const handleJoined = useCallback(({ room }) => {
    console.log(`socket: joined ${room}`);
    setRoomId(room);
    setRoomState(RoomState.JOINED);
  }, []);
  useSocketListener(socket, 'joined', handleJoined);

  const handleLeft = useCallback(() => {
    console.log('socket: left');
    setRoomId('');
    setRoomState((state) => {
      if (state === RoomState.LEAVING) {
        return RoomState.NONE;
      }
      return state;
    });
  }, []);
  useSocketListener(socket, 'left', handleLeft);

  const prevConnected = usePrevious(connected);
  useEffect(() => {
    if (!socket) return;

    // resume connection to room after losing connection
    if (!prevConnected && connected && roomId) {
      database.ref(`rooms/${roomId}/users/${uid}`).set({ mute: false }).then();
      socket.emit('join', { room: roomId });
    }
  }, [connected, database, prevConnected, roomId, socket, uid]);

  const prevRoomState = usePrevious(roomState);
  useEffect(() => {
    if (roomState === RoomState.NONE && socket) {
      joinRoom(null, prevRoomState === RoomState.NONE);
    }
  }, [joinRoom, prevRoomState, roomState, socket, uid]);

  useEffect(() => {
    const onfocus = function (event) {
      console.log('focus');
    };

    const onblur = function (event) {
      console.log('blur');
    };

    window.addEventListener('focus', onfocus);
    window.addEventListener('blur', onblur);
    return () => {
      window.removeEventListener('focus', onfocus);
      window.removeEventListener('blur', onblur);
    };
  }, []);

  return { roomId, roomState, joinRoom, leaveRoom };
}
