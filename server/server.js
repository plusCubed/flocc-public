const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = require('socket.io').listen(server);
const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://floccapp.firebaseio.com',
});

// TODO: Only for dev
admin.firestore().settings({
  host: 'localhost:8080',
  ssl: false,
});

// Get PORT from env variable else assign 3000 for development
const PORT = process.env.PORT || 3010;
server.listen(PORT, null, function () {
  console.log('Listening on port ' + PORT);
});

const roomToSockets = {}; // sets
const uidToSocket = {};

io.use(async (socket, next) => {
  const { idToken } = socket.handshake.query;
  try {
    console.log('verifying id token');
    socket.user = await admin.auth().verifyIdToken(idToken);
    uidToSocket[socket.user.uid] = socket;
    console.log('token verified');
    next();
  } catch (e) {
    next(new Error('forbidden'));
  }
});

io.on('connection', (socket) => {
  // const socketHostName = socket.handshake.headers.host.split(':')[0];
  console.log(`[${socket.id}] connection accepted`);

  function leaveRoom(room) {
    console.log(`[${socket.id}] leave room ${room}`);
    socket.leave(room);
    const firestore = admin.firestore();

    const uid = socket.user.uid;
    socket.to(room).emit('removePeer', {
      peerSocketId: socket.id,
      peerUid: uid,
    });
    roomToSockets[room].delete(socket);

    // Note: Don't use socket anymore, might not exist if disconnecting
    return (async () => {
      await firestore.doc(`rooms/${room}/users/${uid}`).delete();
      // Delete room if no one is there anymore
      const roomUsers = await firestore
        .collection(`rooms/${room}/users`)
        .listDocuments();
      if (roomUsers.length === 0) {
        await firestore.doc(`rooms/${room}`).delete();
      }
    })();
  }

  function leaveAllRooms() {
    const rooms = Object.keys(socket.rooms).filter(
      (room) => room !== socket.id
    );
    if (rooms.length > 1) {
      console.warn(`[${socket.id}] socket in more than 1 room`);
    }
    return Promise.all(rooms.map(leaveRoom));
  }

  socket.on('disconnect', () => {
    console.log(`[${socket.id}] disconnected`);
  });

  socket.on('disconnecting', () => {
    console.log(`[${socket.id}] disconnecting`);
    delete uidToSocket[socket.user.uid];
    leaveAllRooms();
  });

  socket.on('join', async (msg) => {
    console.log(`[${socket.id}] join `, msg);
    const { room } = msg;

    socket.join(room);

    socket.emit('joined', { room });

    if (!roomToSockets[room]) roomToSockets[room] = new Set();

    // Already joined
    if (roomToSockets[room].has(socket)) {
      return;
    }

    socket.to(room).emit('addPeer', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      shouldCreateOffer: false,
    });
    const peerSockets = roomToSockets[room];
    for (const peerSocket of peerSockets) {
      console.log('add peer', peerSocket.id);
      socket.emit('addPeer', {
        peerSocketId: peerSocket.id,
        peerUid: peerSocket.user.uid,
        shouldCreateOffer: true,
      });
    }

    roomToSockets[room].add(socket);
  });

  socket.on('leave', () => {
    console.log(`[${socket.id}] leave all rooms`);
    leaveAllRooms().then(() => {
      socket.emit('left');
    });
  });

  socket.on('relayICECandidate', (msg) => {
    const { peerUid, iceCandidate } = msg;
    const peerSocket = uidToSocket[peerUid];
    console.log(`[${socket.id}] relay ICE-candidate to [${peerSocket.id}]`);

    socket.to(peerSocket.id).emit('iceCandidate', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      iceCandidate: iceCandidate,
    });
  });

  socket.on('relaySessionDescription', (msg) => {
    const { peerUid, sessionDescription } = msg;
    const peerSocket = uidToSocket[peerUid];
    console.log(
      `[${socket.id}] relay SessionDescription to [${peerSocket.id}]`,
      sessionDescription.type
    );

    socket.to(peerSocket.id).emit('sessionDescription', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      sessionDescription: sessionDescription,
    });
  });
});
