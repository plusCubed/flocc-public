import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Audio } from './ui';
import { useSocketListener } from '../util/socketHooks';
import { Peer } from '../util/peer';
import { getOSMicPermissionGranted } from '../util/micPermission';

export const RoomState = {
  NONE: 'NONE',
  JOINING: 'JOINING',
  JOINED: 'JOINED',
  LEAVING: 'LEAVING',
};

function getAudioInputStream(device) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: device,
    },
  });
}

async function getMicStream(inputDevice) {
  const granted = await getOSMicPermissionGranted();
  if (!granted) {
    throw new Error('Microphone permission is required to talk to friends');
  }
  const micStream = await getAudioInputStream(inputDevice);
  if (!micStream) {
    throw new Error('Microphone permission is required to talk to friends');
  }
  console.info('Mic stream obtained');
  return micStream;
}

export function RoomRtc({
  socket,
  mute,
  inputDevice,
  outputDevice,
  onConnectionStatesChange,
}) {
  // non-UI state
  const peers = useRef({});
  // UI state
  const [peerUids, setPeerUids] = useState({});
  const [peerStreams, setPeerStreams] = useState({});
  const [peerConnectionStates, setPeerConnectionStates] = useState({});

  const micStream = useRef(null);

  // update sender tracks / mic stream
  useEffect(() => {
    let canceled = false;
    const updateSenderTracks = async () => {
      const peersList = Object.values(peers.current);

      if (peersList.length === 0 && micStream.current) {
        console.info(`Mic stream stopped`);
        for (const track of micStream.current.getTracks()) {
          track.stop();
        }
        micStream.current = null;
        return;
      }

      if (peersList.length > 0 && !micStream.current) {
        try {
          micStream.current = await getMicStream(inputDevice);
        } catch (err) {
          alert(err);
          micStream.current = null;
        }
      }
      if (canceled) {
        return;
      }

      const micTrack = micStream.current?.getTracks()?.[0];
      if (!micTrack) return;
      micTrack.enabled = !mute; // set mute
      for (const peer of peersList) {
        const senders = peer.pc.getSenders();
        if (senders.length === 0 || (senders[0] && !senders[0].track)) {
          console.info(`[${peer.peerUid}] add mic track`);
          peer.pc.addTrack(micTrack, micStream.current);
        } else if (senders[0].track.id !== micTrack.id) {
          console.info(`[${peer.peerUid}] replace mic track`);
          senders[0].replaceTrack(micTrack).catch((err) => {
            console.error(err);
          });
        }
      }
    };
    updateSenderTracks();

    return () => {
      canceled = true;
    };
  }, [peerUids, mute, inputDevice]);

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
      console.info(`socket: [${peerUid}] addPeer, polite:`, polite);

      if (peerUid in peers.current) {
        // Already added
        console.warn(`[${peerUid}] already added`);
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
      setPeerUids(Object.keys(peers.current));
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
    setPeerUids(Object.keys(peers.current));
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
