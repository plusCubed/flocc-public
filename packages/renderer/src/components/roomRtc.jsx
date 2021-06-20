import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useRecoilValue } from 'recoil';

import joinedSound from '../../assets/sounds/joined.wav';
import leftSound from '../../assets/sounds/left.wav';
import { audioInputAtom, audioOutputAtom } from '../atoms/audioDeviceAtom';
import { useSocketListener } from '../hooks/useSocket';
import { useUid } from '../hooks/useUid';
import { getOSMicPermissionGranted } from '../util/micPermission';
import { Peer } from '../util/peer';
import { playSound } from '../util/playSound';

import { Audio } from './ui';

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

const AddPeerType = {
  OTHER_JOINING: 'OTHER_JOINING',
  ME_JOINING: 'ME_JOINING',
};

const RemovePeerType = {
  OTHER_LEAVING: 'OTHER_LEAVING',
  ME_LEAVING: 'ME_LEAVING',
};

export function RoomRtc({ socket, mute, onConnectionStatesChange }) {
  const uid = useUid();

  const inputDevice = useRecoilValue(audioInputAtom);
  const outputDevice = useRecoilValue(audioOutputAtom);

  // non-UI state
  const peers = useRef({});
  // UI state
  const [peerUids, setPeerUids] = useState({});
  const [peerStreams, setPeerStreams] = useState({});
  const [peerConnectionStates, setPeerConnectionStates] = useState({});

  const micStreamState = useRef(null);

  // update sender tracks / mic stream
  useEffect(() => {
    let canceled = false;
    const updateSenderTracks = async () => {
      const peersList = Object.values(peers.current);
      // No peers => disconnect mic stream
      if (peersList.length === 0 && micStreamState.current) {
        console.info(`Mic stream stopped`);
        for (const track of micStreamState.current?.stream.getTracks()) {
          track.stop();
        }
        micStreamState.current = null;
        return;
      }

      // Yes peers & need to obtain mic stream
      if (
        peersList.length > 0 &&
        (!micStreamState.current ||
          micStreamState.current.device !== inputDevice)
      ) {
        try {
          micStreamState.current = {
            device: inputDevice,
            stream: await getMicStream(inputDevice),
          };
        } catch (err) {
          alert(err);
          micStreamState.current = null;
        }
      }
      if (canceled) {
        return;
      }

      const micTrack = micStreamState.current?.stream.getTracks()?.[0];
      if (!micTrack) return;
      micTrack.enabled = !mute; // set mute
      for (const peer of peersList) {
        const senders = peer.pc.getSenders();
        if (senders.length === 0 || (senders[0] && !senders[0].track)) {
          console.info(`[${peer.peerUid}] add mic track`);
          peer.pc.addTrack(micTrack, micStreamState.current?.stream);
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

  // set up signal handler
  useEffect(() => {
    const handleSignal = (obj) => {
      socket.emit('signal', obj);
    };
    const peerArr = Object.values(peers.current);

    for (const peer of peerArr) {
      peer.on('signal', handleSignal);
    }
    return () => {
      for (const peer of peerArr) {
        peer.off('signal', handleSignal);
      }
    };
  }, [socket, peerUids]);

  useEffect(() => {
    onConnectionStatesChange(peerConnectionStates);
  }, [peerConnectionStates, onConnectionStatesChange]);

  const addPeer = useCallback(
    ({ peerSocketId, peerUid, type }) => {
      if (peerUid in peers.current) {
        // Already added
        return;
      }

      const polite = uid < peerUid;
      console.info(`addPeer ${peerUid}, polite:`, polite);

      const peer = new Peer(peerUid, polite);

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

      if (type === AddPeerType.OTHER_JOINING) {
        console.log('other join: play sound');
        playSound(joinedSound, outputDevice);
      }
    },
    [outputDevice, uid]
  );
  useSocketListener(socket, 'addPeer', addPeer);

  const removePeer = useCallback(
    ({ peerUid, type }) => {
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

      if (type === RemovePeerType.OTHER_LEAVING) {
        console.log('other leave: play sound');
        playSound(leftSound, outputDevice);
      }
    },
    [outputDevice]
  );
  useSocketListener(socket, 'removePeer', removePeer);

  // WebRTC signaling
  const processSignal = useCallback(
    ({ peerSocketId, peerUid, data }) => {
      console.info(`socket: [${peerUid}] signaling data received`, data);

      if (!(peerUid in peers.current)) {
        addPeer({ peerSocketId, peerUid });
      }

      const peer = peers.current[peerUid];

      if (data.sdp) {
        const description = new RTCSessionDescription(data.sdp);
        peer.processDescription(description).catch((err) => {
          console.error(err);
        });
      }

      if (data.candidate) {
        const candidate = new RTCIceCandidate(data.candidate);
        peer.processCandidate(candidate).catch((err) => {
          console.error(err);
        });
      }
    },
    [addPeer]
  );
  useSocketListener(socket, 'signal', processSignal);

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
