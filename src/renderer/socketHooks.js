import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useSocket(endpoint, user) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let ignore = false;
    let socket = null;

    async function connectSocket() {
      const idToken = await user.getIdToken();
      if (ignore) return;
      socket = io(endpoint, { query: { idToken } });
      socket.on('connect', () => {
        console.log('Connected to signaling server');
        setConnected(true);
      });
      socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        setConnected(false);
      });
      socket.on('error', (e) => {
        console.error('Signaling socket error', e);
      });
      setSocket(socket);
    }

    connectSocket();
    return () => {
      if (socket) socket.close();
      ignore = true;
    };
  }, [endpoint, user]);

  return { socket, connected };
}

export function useSocketListener(socket, eventName, listener) {
  useEffect(() => {
    if (!socket) return;

    socket.on(eventName, listener);

    return () => socket.off(eventName, listener);
  }, [eventName, listener, socket]);
}
