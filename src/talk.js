import React, { useCallback, useEffect, useState, Suspense } from 'react';
import 'webrtc-adapter';
import {
  useFirestore,
  useFirestoreCollection,
  useFirestoreCollectionData,
  useUser,
} from 'reactfire';

import { Audio } from './components';

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
 * @param collectionRef
 * @param processDoc Returns a promise
 * @param onProcessed
 */
function useFirestoreProcessQueue(collectionRef, processDoc, onProcessed) {
  const firestore = useFirestore();
  /** @type firebase.firestore.QuerySnapshot */
  const queue = useFirestoreCollection(collectionRef);
  useEffect(() => {
    let ignore = false;
    async function processQueue() {
      const deleteBatch = firestore.batch();
      queue.forEach((doc) => {
        const docData = doc.data();
        deleteBatch.delete(doc.ref);
        if (!ignore) {
          processDoc(docData);
        }
      });
      if (!ignore) {
        await deleteBatch.commit();
        if (onProcessed) {
          onProcessed();
        }
      }
    }
    processQueue();
    return () => {
      ignore = true;
    };
  }, [firestore, onProcessed, processDoc, queue]);
}

/**
 * @param {Object} props
 * @param props.roomId Valid room ID.
 * @param props.micStream
 * @param props.outputDevice
 * @returns {JSX.Element}
 * @constructor
 */
export function RoomAudio({ roomId, micStream, outputDevice }) {
  const uid = useUser().uid;
  const firestore = useFirestore();

  // {uid: {connection, stream}}
  const [connectionsByUid, setConnectionsByUid] = useState({});

  const createPeerConnection = useCallback(
    (peerId) => {
      console.info('Create peer connection to peer', peerId);
      const connection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });
      registerPeerConnectionListeners(connection);
      connection.addEventListener('icecandidate', (event) => {
        console.info('Sending ICE Candidate', peerId);
        if (event.candidate) {
          firestore.collection(`rooms/${roomId}/users/${peerId}/icecandidates`).add({
            uid,
            candidate: event.candidate.toJSON(),
          });
        }
      });
      micStream.getTracks().forEach((track) => {
        connection.addTrack(track, micStream);
      });
      return connection;
    },
    [firestore, micStream, roomId, uid]
  );

  const roomUserDocRef = firestore.doc(`rooms/${roomId}/users/${uid}`);

  // A user joins this room: incoming offer (& send answer)
  const processOffer = useCallback(
    async ({ uid: peerUid, offer }) => {
      console.info('Processing offer from peer', peerUid);
      const connection = createPeerConnection(peerUid);

      const remoteDesc = new RTCSessionDescription(offer);
      await connection.setRemoteDescription(remoteDesc);

      // Send answer
      console.info('Send answer to peer', peerUid);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      firestore
        .collection('rooms')
        .doc(roomId)
        .collection('users')
        .doc(peerUid)
        .collection('answers')
        .add({ uid, answer: answer.toJSON() });

      setConnectionsByUid((connectionsByUid) => ({
        ...connectionsByUid,
        [peerUid]: { connection, stream: new MediaStream() },
      }));
    },
    [createPeerConnection, roomId, firestore, uid]
  );
  const handleOffersProcessed = useCallback(() => {
    console.info('Finished processing all offers');
  }, []);
  useFirestoreProcessQueue(
    roomUserDocRef.collection('offers'),
    processOffer,
    handleOffersProcessed
  );

  // After joining a room: answers return from the other users
  const processAnswers = useCallback(
    async ({ uid: peerUid, answer }) => {
      console.info('Processing answer from peer', peerUid);
      const remoteDesc = new RTCSessionDescription(answer);
      await connectionsByUid[peerUid].connection.setRemoteDescription(
        remoteDesc
      );
    },
    [connectionsByUid]
  );
  const handleAnswersProcessed = useCallback(() => {
    console.info('Finished processing all answers');
  }, []);
  useFirestoreProcessQueue(
    roomUserDocRef.collection('answers'),
    processAnswers,
    handleAnswersProcessed
  );

  // Process ice candidates
  const processIceCandidates = useCallback(
    async ({ uid: peerUid, candidate }) => {
      console.info('Processing ice candidate from peer', peerUid);
      try {
        await connectionsByUid[peerUid].connection.addIceCandidate(candidate);
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    },
    [connectionsByUid]
  );
  const handleIceCandidatesProcessed = useCallback(() => {
    console.info('Finished processing ICE candidates');
  }, []);
  useFirestoreProcessQueue(
    roomUserDocRef.collection('icecandidates'),
    processIceCandidates,
    handleIceCandidatesProcessed
  );

  // Join room when room ID changes
  useEffect(() => {
    const joinRoom = async () => {
      console.info('Joining room', roomId);
      const currentRoomDocRef = firestore.collection('rooms').doc(roomId);

      // Send offer to all other users
      const usersSnapshot = await currentRoomDocRef.collection('users').get();
      const otherUserRefs = [];
      usersSnapshot.forEach((doc) => {
        if (doc.id !== uid) {
          otherUserRefs.push(doc.ref);
        }
      });
      await Promise.all(
        otherUserRefs.map(async (userRef) => {
          const peerUid = userRef.id;
          const connection = createPeerConnection(peerUid);

          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await userRef
            .collection('offers')
            .add({ uid, offer: offer.toJSON() });

          console.info('Sending offer to peer', peerUid);
          setConnectionsByUid((connectionsByUid) => ({
            ...connectionsByUid,
            [peerUid]: { connection, stream: new MediaStream() },
          }));
        })
      );
    };
    joinRoom();
  }, [roomId, createPeerConnection, firestore, uid]);

  return (
    <div>
      {Object.entries(connectionsByUid).map(
        ([peerUid, { connection, stream }]) => (
          <Audio key={peerUid} controls autoPlay srcObject={stream} />
        )
      )}
    </div>
  );
}

function useFirestoreCollectionDocIds(collectionRef) {
  /** @type firebase.firestore.QuerySnapshot */
  const snapshot = useFirestoreCollection(collectionRef);
  return snapshot.docs.map((docSnapshot) => docSnapshot.id);
}

function RoomUsers({ roomId }) {
  const firestore = useFirestore();
  const userIds = useFirestoreCollectionDocIds(
    useFirestore().collection(`rooms/${roomId}/users`)
  );
  const [userDocs, setUserDocs] = useState({});
  useEffect(() => {
    let ignore = false;
    firestore.runTransaction(async (transaction) => {
      /** @type firebase.firestore.DocumentSnapshot[] */
      const docSnapshots = await Promise.all(
        userIds.map((userId) => {
          return transaction.get(firestore.doc(`users/${userId}`));
        })
      );
      const newUserDocs = {};
      for (const snapshot of docSnapshots) {
        newUserDocs[snapshot.id] = snapshot.data();
      }
      if (!ignore) {
        setUserDocs(newUserDocs);
      }
    });

    return () => {
      ignore = true;
    };
  }, [firestore, userIds]);

  return (
    <div>
      {Object.entries(userDocs).map(([uid, userDoc]) => (
        <div key={uid}>{userDoc.displayName}</div>
      ))}
    </div>
  );
}

export function RoomSelector() {
  const firestore = useFirestore();
  const uid = useUser().uid;

  const roomIds = useFirestoreCollectionDocIds(firestore.collection('rooms'));

  const handleJoinRoom = async (id) => {
    // Add this user to room users
    await firestore
      .collection('rooms')
      .doc(id)
      .collection('users')
      .doc(uid)
      .set({});
    // Set room for this user
    await firestore.collection('users').doc(uid).set({ room: id });
  };

  const handleCreateRoom = async () => {
    return await firestore.collection('rooms').add({});
  };

  const handleCreateAndJoinRoom = async () => {
    const id = (await handleCreateRoom()).id;
    await handleJoinRoom(id);
  };

  return (
    <div>
      {roomIds.map((id) => (
        <div key={id} className="border border-solid border-gray-700 rounded">
          <Suspense fallback={<div>Loading...</div>}>
            <RoomUsers roomId={id} />
          </Suspense>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            key={id}
            onClick={() => handleJoinRoom(id)}
          >
            Join room
          </button>
        </div>
      ))}
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={handleCreateAndJoinRoom}
      >
        New room
      </button>
    </div>
  );
}

function registerPeerConnectionListeners(peerConnection) {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`
    );
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
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
