import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'webrtc-adapter';

import { Audio } from './ui';
import { useSocketListener } from './socketHooks';
import { getOSMicPermissionGranted } from './micPermission';

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

// Always loaded, just sectioned off
export function SocketRtc({
  socket,
  mute,
  micStreamRef,
  outputDevice,
  onConnectionStateChange,
}) {
  const [uidToConnectionContext, setUidToConnectionContext] = useState({}); // {connection, stream}
  const [uidToConnectionState, setUidToConnectionState] = useState({}); // RTCPeerConnectionState
  const rtpSendersByUid = useRef({}); // rtcRtpSender

  useEffect(() => {
    onConnectionStateChange(uidToConnectionState);
  }, [uidToConnectionState, onConnectionStateChange]);

  // cleanup
  useEffect(() => {
    return () => {
      setUidToConnectionContext((connectionsByUid) => {
        for (const { connection } of Object.values(connectionsByUid)) {
          connection.close();
        }
        return {};
      });
    };
  }, []);

  // set mute
  useEffect(() => {
    if (!micStreamRef.current) return;
    /** @type MediaStreamTrack*/
    const micTrack = micStreamRef.current.getTracks()[0];
    if (micTrack.enabled !== !mute) {
      micTrack.enabled = !mute;
    }
  }, [micStreamRef, mute]);

  // update rtpSendersByUid
  useEffect(() => {
    if (!micStreamRef.current) return;

    const micTrack = micStreamRef.current.getTracks()[0];
    const connections = Object.entries(uidToConnectionContext);

    for (const [peerUid, { connection }] of connections) {
      /** @type RTCRtpSender */
      const sender = rtpSendersByUid.current[peerUid];
      if (sender) {
        if (sender.track.id !== micTrack.id) {
          console.log(`[${peerUid}] replace mic track`);
          sender.replaceTrack(micTrack).catch((e) => {
            console.error(`[${peerUid}] replace audio track failed`, e);
          });
        }
      } else {
        console.log(`[${peerUid}] add mic track`);
        rtpSendersByUid.current[peerUid] = connection.addTrack(
          micTrack,
          micStreamRef.current
        );
      }
    }

    const senderUids = Object.keys(rtpSendersByUid.current);
    for (const uid of senderUids) {
      if (!(uid in uidToConnectionContext)) {
        delete rtpSendersByUid.current[uid];
      }
    }
  }, [uidToConnectionContext, micStreamRef]);

  const addPeer = useCallback(
    async ({ peerSocketId, peerUid, shouldCreateOffer }) => {
      async function sendOffer(peerUid, connection) {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        console.info(`[${peerUid}] sending offer`);
        socket.emit('relaySessionDescription', {
          peerUid: peerUid,
          sessionDescription: offer.toJSON(),
        });
      }

      async function createConnection() {
        console.info(`[${peerUid}] adding peer`);
        console.info(`[${peerUid}] create peer connection to peer`);
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
          setUidToConnectionState((connectionStateByUid) => ({
            ...connectionStateByUid,
            [peerUid]: state,
          }));
        });
        // Add mic stream to connection
        rtpSendersByUid.current[peerUid] = connection.addTrack(
          micStreamRef.current.getTracks()[0],
          micStreamRef.current
        );
        // Listen for remote streams
        const receivedStream = new MediaStream();
        connection.addEventListener('track', (event) => {
          receivedStream.addTrack(event.track, receivedStream);
        });

        const connectionContext = { connection, stream: receivedStream };
        if (shouldCreateOffer) {
          await sendOffer(peerUid, connectionContext.connection);
        }
        setUidToConnectionContext({
          ...uidToConnectionContext,
          [peerUid]: connectionContext,
        });
      }

      if (peerUid in uidToConnectionContext) {
        return;
      }
      if (!micStreamRef.current) {
        console.error('no mic stream, cannot start connection');
        return;
      }

      await createConnection();
    },
    [micStreamRef, socket, uidToConnectionContext]
  );
  useSocketListener(socket, 'addPeer', addPeer);

  const removePeer = useCallback(({ peerUid }) => {
    setUidToConnectionState((connectionStateByUid) => {
      const { [peerUid]: _, ...res } = { ...connectionStateByUid };
      return res;
    });
    setUidToConnectionContext((connectionsByUid) => {
      if (peerUid in connectionsByUid) {
        connectionsByUid[peerUid].connection.close();
      }
      const { [peerUid]: _, ...res } = { ...connectionsByUid };
      return res;
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
      if (!(peerUid in uidToConnectionContext)) {
        console.error(`[${peerUid}] ERROR: peer uid not added`);
        return;
      }
      const connection = uidToConnectionContext[peerUid].connection;
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
    [uidToConnectionContext, socket]
  );

  useSocketListener(socket, 'sessionDescription', processSessionDescription);

  const processIceCandidate = useCallback(
    async ({ peerSocketId, peerUid, iceCandidate }) => {
      console.info(`[${peerUid}] received ice candidate`);
      if (!(peerUid in uidToConnectionContext)) {
        console.error(`[${peerUid}] ERROR: peer uid not added`);
        return;
      }
      try {
        await uidToConnectionContext[peerUid].connection.addIceCandidate(
          new RTCIceCandidate(iceCandidate)
        );
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    },
    [uidToConnectionContext]
  );
  useSocketListener(socket, 'iceCandidate', processIceCandidate);

  return (
    <>
      {Object.entries(uidToConnectionContext).map(
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
