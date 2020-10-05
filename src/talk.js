import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import 'webrtc-adapter';
import {
  useDatabase,
  useDatabaseListData,
  useDatabaseObjectData,
  useUser,
} from 'reactfire';

import { Audio, Button } from './ui';
import { useSocketListener } from './socket-hooks';
import usePromise from 'react-promise-suspense';

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
export function RoomAudio({ socket, currentRoom, micStream, outputDevice }) {
  // {uid: {connection, stream, rtcRtpSender}}
  const [connectionsByUid, setConnectionsByUid] = useState({});
  const [connectionStateByUid, setConnectionStateByUid] = useState({});
  const sendersByUid = useRef({});

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
    const entries = Object.entries(connectionsByUid);

    for (const [peerUid, { connection }] of entries) {
      const sender = sendersByUid.current[peerUid];
      if (sender) {
        console.log(`[${peerUid}] replace mic track`);
        sender.replaceTrack(micStream.getTracks()[0]).catch((e) => {
          console.error(`[${peerUid}] replace audio track failed`, e);
        });
      } else {
        console.log(`[${peerUid}] add mic track`);
        sendersByUid.current[peerUid] = connection.addTrack(
          micStream.getTracks()[0],
          micStream
        );
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
    <div>
      {Object.entries(connectionsByUid).map(
        ([peerUid, { connection, stream }]) => (
          <div key={peerUid}>
            <div>
              {peerUid}: {connectionStateByUid[peerUid]}
            </div>
            <Audio autoPlay srcObject={stream} sinkId={outputDevice} />
          </div>
        )
      )}
    </div>
  );
}

/**
 * @param {firebase.database.Reference} ref
 * @param childKeys
 */
function useDatabaseObjectDataPartial(ref, childKeys) {
  async function getPartial(ref, keys) {
    /** @type firebase.database.DataSnapshot[] */
    const docSnapshots = await Promise.all(
      keys.map((key) => ref.child(key).once('value'))
    );
    const partial = {};
    for (const snapshot of docSnapshots) {
      partial[snapshot.key] = snapshot.val();
    }
    return partial;
  }

  return usePromise(getPartial, [ref, childKeys]);
}

function RoomUsers({ roomId }) {
  const database = useDatabase();
  const roomUsers = useDatabaseObjectData(
    database.ref(`rooms/${roomId}/users`)
  );
  const userIds = Object.keys(roomUsers);
  const userDocs = useDatabaseObjectDataPartial(database.ref('users'), userIds);

  return (
    <div>
      {Object.entries(userDocs).map(([uid, userDoc]) => (
        <div key={uid}>{userDoc.displayName}</div>
      ))}
    </div>
  );
}

function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function RoomSelector({ currentRoom, setCurrentRoom, leaveRoom }) {
  const database = useDatabase();
  const uid = useUser().uid;

  const allRooms = useDatabaseObjectData(database.ref('rooms'));
  const allRoomIds = Object.keys(allRooms);

  const handleJoinRoom = async (id) => {
    setCurrentRoom({ id, state: RoomState.JOINING });
    await database.ref(`rooms/${id}/users/${uid}`).set(true);
  };

  const handleCreateAndJoinRoom = async () => {
    const roomRef = database.ref(`rooms/${makeid(10)}`);
    setCurrentRoom({ id: roomRef.key, state: RoomState.JOINING });
    await roomRef.set({ users: { [uid]: true } });
  };

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  const transitioning =
    currentRoom.state === RoomState.JOINING ||
    currentRoom.state === RoomState.LEAVING;
  return (
    <div>
      {allRoomIds.map((id) => (
        <div key={id} className="border border-solid border-gray-700 rounded">
          <Suspense fallback={<div>Loading...</div>}>
            <RoomUsers roomId={id} />
          </Suspense>
          {currentRoom.state === RoomState.JOINED && currentRoom.id === id ? (
            <Button onClick={() => handleLeaveRoom(id)}>Leave room</Button>
          ) : (
            <Button onClick={() => handleJoinRoom(id)} disabled={transitioning}>
              Join room
            </Button>
          )}
        </div>
      ))}
      <Button onClick={handleCreateAndJoinRoom} disabled={transitioning}>
        New room
      </Button>
    </div>
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
