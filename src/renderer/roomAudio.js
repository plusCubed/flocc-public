import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'webrtc-adapter';

import { Audio } from './ui';
import { useSocketListener } from './socketHooks';

export const RoomState = {
  NONE: 'NONE',
  JOINING: 'JOINING',
  JOINED: 'JOINED',
  LEAVING: 'LEAVING',
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.sipnet.net:3478' },
  { urls: 'stun:stun.ideasip.com:3478' },
  { urls: 'stun:stun.iptel.org:3478' },
  {
    urls: [
      'turn:173.194.72.127:19305?transport=udp',
      'turn:[2404:6800:4008:C01::7F]:19305?transport=udp',
      'turn:173.194.72.127:443?transport=tcp',
      'turn:[2404:6800:4008:C01::7F]:443?transport=tcp',
    ],
    username: 'CKjCuLwFEgahxNRjuTAYzc/s6OMT',
    credential: 'u1SQDR/SQsPQIxXNWQT7czc/G4c=',
  },
];

/**
 * @param {Object} props
 * @param props.micStream
 * @param props.outputDevice
 * @returns {JSX.Element}
 * @constructor
 */
export function RoomAudio({
  socket,
  micStream,
  outputDevice,
  onConnectionStateChange,
}) {
  // {uid: {connection, stream, rtcRtpSender}}
  const [connectionsByUid, setConnectionsByUid] = useState({});
  const [connectionStateByUid, setConnectionStateByUid] = useState({});
  const sendersByUid = useRef({});

  useEffect(() => {
    onConnectionStateChange(connectionStateByUid);
  }, [connectionStateByUid, onConnectionStateChange]);

  // cleanup
  useEffect(() => {
    return () => {
      setConnectionsByUid((connectionsByUid) => {
        for (const { connection } of Object.values(connectionsByUid)) {
          connection.close();
        }
        return {};
      });
    };
  }, []);

  useEffect(() => {
    const micTrack = micStream.getTracks()[0];
    const entries = Object.entries(connectionsByUid);

    for (const [peerUid, { connection }] of entries) {
      /** @type RTCRtpSender */
      const sender = sendersByUid.current[peerUid];
      if (sender) {
        if (sender.track.id !== micTrack.id) {
          console.log(`[${peerUid}] replace mic track`);
          sender.replaceTrack(micTrack).catch((e) => {
            console.error(`[${peerUid}] replace audio track failed`, e);
          });
        }
      } else {
        console.log(`[${peerUid}] add mic track`);
        sendersByUid.current[peerUid] = connection.addTrack(
          micTrack,
          micStream
        );
      }
    }

    const senderUids = Object.keys(sendersByUid.current);
    for (const uid of senderUids) {
      if (!(uid in connectionsByUid)) {
        delete sendersByUid.current[uid];
      }
    }
  }, [connectionsByUid, micStream]);

  const addPeer = useCallback(
    ({ peerSocketId, peerUid, shouldCreateOffer }) => {
      function createConnection(peerUid) {
        console.info('Create peer connection to peer ', peerUid);
        const connection = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
        });
        registerPeerConnectionListeners(connection);
        connection.addEventListener('icecandidate', (event) => {
          console.info(`[${peerUid}] sending ice candidate`);
          if (event.candidate) {
            socket.emit('relayICECandidate', {
              peerUid: peerUid,
              iceCandidate: event.candidate.toJSON(),
            });
          }
        });
        connection.addEventListener('connectionstatechange', () => {
          const state = connection.connectionState;
          console.log(`Connection state change: ${state}`);
          setConnectionStateByUid((connectionStateByUid) => ({
            ...connectionStateByUid,
            [peerUid]: state,
          }));
        });
        // Add mic stream to connection
        sendersByUid.current[peerUid] = connection.addTrack(
          micStream.getTracks()[0],
          micStream
        );
        // Listen for remote streams
        const stream = new MediaStream();
        connection.addEventListener('track', (event) => {
          stream.addTrack(event.track, stream);
        });
        return { connection, stream };
      }

      async function sendOffer(peerUid, connection) {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        console.info(`[${peerUid}] sending offer`);
        socket.emit('relaySessionDescription', {
          peerUid: peerUid,
          sessionDescription: offer.toJSON(),
        });
      }

      setConnectionsByUid((connectionsByUid) => {
        if (peerUid in connectionsByUid) {
          console.warn(`[${peerUid}] peer already added`);
          return connectionsByUid;
        }
        console.info(`[${peerUid}] adding peer`);
        const connectionContext = createConnection(peerUid);
        if (shouldCreateOffer) {
          sendOffer(peerUid, connectionContext.connection);
        }
        return {
          ...connectionsByUid,
          [peerUid]: connectionContext,
        };
      });
    },
    [micStream, socket]
  );
  useSocketListener(socket, 'addPeer', addPeer);

  const removePeer = useCallback(({ peerUid }) => {
    setConnectionStateByUid((connectionStateByUid) => {
      const connectionStateByUidCopy = { ...connectionStateByUid };
      delete connectionStateByUidCopy[peerUid];
      return connectionStateByUidCopy;
    });
    setConnectionsByUid((connectionsByUid) => {
      const connectionsByUidCopy = { ...connectionsByUid };
      if (peerUid in connectionsByUidCopy) {
        connectionsByUidCopy[peerUid].connection.close();
        delete connectionsByUidCopy[peerUid];
      }
      return connectionsByUidCopy;
    });
  }, []);
  useSocketListener(socket, 'removePeer', removePeer);

  const processSessionDescription = useCallback(
    async ({ peerSocketId, peerUid, sessionDescription }) => {
      console.info(
        `[${peerUid}] received session description`,
        sessionDescription
      );
      const remoteDesc = new RTCSessionDescription(sessionDescription);
      if (!(peerUid in connectionsByUid)) {
        console.error(`[${peerUid}] ERROR: peer uid not added`);
        return;
      }
      const connection = connectionsByUid[peerUid].connection;
      await connection.setRemoteDescription(remoteDesc);

      if (remoteDesc.type === 'offer') {
        // Send answer
        console.info(`[${peerUid}] sending answer`);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        socket.emit('relaySessionDescription', {
          peerUid: peerUid,
          sessionDescription: answer.toJSON(),
        });
      }
    },
    [connectionsByUid, socket]
  );

  useSocketListener(socket, 'sessionDescription', processSessionDescription);

  const processIceCandidate = useCallback(
    async ({ peerSocketId, peerUid, iceCandidate }) => {
      console.info(`[${peerUid}] received ice candidate`);
      if (!(peerUid in connectionsByUid)) {
        console.error(`[${peerUid}] ERROR: peer uid not added`);
        return;
      }
      try {
        await connectionsByUid[peerUid].connection.addIceCandidate(
          new RTCIceCandidate(iceCandidate)
        );
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    },
    [connectionsByUid]
  );
  useSocketListener(socket, 'iceCandidate', processIceCandidate);

  return (
    <>
      {Object.entries(connectionsByUid).map(
        ([peerUid, { connection, stream }]) => (
          <Audio
            key={peerUid}
            autoPlay
            srcObject={stream}
            sinkId={outputDevice}
          />
        )
      )}
    </>
  );
}

function registerPeerConnectionListeners(peerConnection) {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`
    );
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
      `ICE connection state change: ${peerConnection.iceConnectionState}`
    );
  });
}
