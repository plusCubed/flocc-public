import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Audio } from './ui';
import { useSocketListener } from '../util/socketHooks';
import { Peer } from '../util/peer';

export const RoomState = {
  NONE: 'NONE',
  JOINING: 'JOINING',
  JOINED: 'JOINED',
  LEAVING: 'LEAVING',
};

export function RoomRtc({
  socket,
  mute,
  micStream,
  outputDevice,
  onConnectionStatesChange,
}) {
  // non-UI state
  const peers = useRef({});
  // UI state
  const [peerStreams, setPeerStreams] = useState({});
  const [peerConnectionStates, setPeerConnectionStates] = useState({});

  const peerUids = Object.keys(peerConnectionStates);

  // update sender tracks
  useEffect(() => {
    for (const peer of Object.values(peers.current)) {
      const micTrack = micStream?.getTracks()?.[0];
      if (!micTrack) {
        return;
      }
      const senders = peer.pc.getSenders();
      if (senders.length === 0 || (senders[0] && !senders[0].track)) {
        console.info(`[${peer.peerUid}] add mic track`);
        peer.pc.addTrack(micTrack, micStream);
      } else if (senders[0].track.id !== micTrack.id) {
        console.info(`[${peer.peerUid}] replace mic track`);
        senders[0].replaceTrack(micTrack).catch((err) => {
          console.error(err);
        });
      }
    }
  }, [peerUids, micStream]);

  // set mute
  useEffect(() => {
    if (!micStream) return;
    const micTrack = micStream.getTracks()[0];
    micTrack.enabled = !mute;
  }, [micStream, mute]);

  // update socket
  useEffect(() => {
    for (const peer of Object.values(peers.current)) {
      peer.updateSocket(socket);
    }
  }, [socket]);

  useEffect(() => {
    onConnectionStatesChange(peerConnectionStates);
  }, [peerConnectionStates, onConnectionStatesChange]);

  const addPeer = useCallback(
    ({ peerSocketId, peerUid, shouldCreateOffer: polite }) => {
      console.info(`socket: [${peerUid}] addPeer`);

      if (peerUid in peers.current) {
        // Already added
        return;
      }

      const peer = new Peer(peerUid, polite, socket);

      peer.on('stream', (inboundStream) => {
        setPeerStreams((peerStreams) => ({
          ...peerStreams,
          [peerUid]: inboundStream,
        }));
      });
      peer.on('connectionStateChange', (connectionState) => {
        setPeerConnectionStates((connectionStates) => ({
          ...connectionStates,
          [peerUid]: connectionState,
        }));
      });

      peers.current[peerUid] = peer;
    },
    [socket]
  );
  useSocketListener(socket, 'addPeer', addPeer);

  const removePeer = useCallback(({ peerUid }) => {
    console.info(`socket: [${peerUid}] removePeer`);

    if (peerUid in peers.current) {
      peers.current[peerUid].destroy();
      delete peers.current[peerUid];
    }
    setPeerStreams((peerStreams) => {
      const { [peerUid]: _, ...filtered } = peerStreams;
      return filtered;
    });
    setPeerConnectionStates((connectionStates) => {
      const { [peerUid]: _, ...filtered } = connectionStates;
      return filtered;
    });
  }, []);
  useSocketListener(socket, 'removePeer', removePeer);

  const processSessionDescription = useCallback(
    ({ peerSocketId, peerUid, sessionDescription }) => {
      console.info(
        `socket: [${peerUid}] sessionDescription received`,
        sessionDescription
      );

      if (!(peerUid in peers.current)) {
        console.error(`[${peerUid}] ERROR: peer uid not found`);
        return;
      }

      const peer = peers.current[peerUid];
      const description = new RTCSessionDescription(sessionDescription);
      peer.processDescription(description).catch((err) => {
        console.error(err);
      });
    },
    []
  );
  useSocketListener(socket, 'sessionDescription', processSessionDescription);

  const processIceCandidate = useCallback(
    ({ peerSocketId, peerUid, iceCandidate }) => {
      console.info(`socket: [${peerUid}] iceCandidate received`);
      if (!(peerUid in peers.current)) {
        console.error(`[${peerUid}] ERROR: peer uid not found`);
        return;
      }
      const peer = peers.current[peerUid];
      const candidate = new RTCIceCandidate(iceCandidate);
      peer.processCandidate(candidate).catch((err) => {
        console.error(err);
      });
    },
    []
  );
  useSocketListener(socket, 'iceCandidate', processIceCandidate);

  return (
    <>
      {Object.keys(peerStreams).map((peerUid) => (
        <Audio
          key={peerUid}
          autoPlay
          srcObject={peerStreams[peerUid]}
          sinkId={outputDevice}
        />
      ))}
    </>
  );
}
