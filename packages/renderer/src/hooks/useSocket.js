import { useEffect, useState } from 'react';

import io from 'socket.io-client';

export function useSocket(endpoint, user) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let ignore = false;
    let socket = null;

    async function connectSocket() {
      const idToken = await user.getIdToken(true);
      if (ignore) return;
      socket = io(endpoint, {
        query: { idToken, version: '3' },
        transports: ['websocket'],
      });
      socket.on('connect', () => {
        console.log('Connected to signaling server');
        setConnected(true);
      });
      socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        setConnected(false);
      });
      socket.on('connect_error', async (e) => {
        console.error('Signaling socket error:', e);
        switch (e.message) {
          case 'forbidden': {
            socket.disconnect();
            setTimeout(async () => {
              console.log('attempt reconnect');
              const idToken = await user.getIdToken(false);
              socket.io.opts.query = { idToken, version: '3' };
              socket.connect();
            }, 1000);
            break;
          }
          case 'protocol_version': {
            alert('Update required');
            break;
          }
          default:
            break;
        }
      });
      setSocket(socket);
    }

    connectSocket();
    return () => {
      if (socket) socket.disconnect();
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
