const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const admin = require('firebase-admin');
const fs = require('fs');

const isDevelopment = process.env.NODE_ENV !== 'production';

const app = express();
const server = isDevelopment
  ? http.createServer(app)
  : https.createServer(
      {
        key: fs.readFileSync('cert/key.pem', 'utf8'),
        cert: fs.readFileSync('cert/cert.pem', 'utf8'),
      },
      app
    );
const io = require('socket.io').listen(server);

const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://floccapp.firebaseio.com',
});

async function cleanupRooms() {
  const rooms = (await admin.database().ref('rooms').once('value')).val();
  for (const [room, roomDoc] of Object.entries(rooms)) {
    if (!roomDoc.users && !roomDoc.permanent) {
      await admin.database().ref(`rooms/${room}`).remove();
    }
  }
}
cleanupRooms();

// Get PORT from env variable else assign 3000 for development
const PORT = isDevelopment ? process.env.PORT || 3010 : 8443;
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
    const database = admin.database();

    const uid = socket.user.uid;
    socket.to(room).emit('removePeer', {
      peerSocketId: socket.id,
      peerUid: uid,
    });
    for (const peerSocket of roomToSockets[room]) {
      socket.emit('removePeer', {
        peerSocketId: peerSocket.id,
        peerUid: peerSocket.user.uid,
      });
    }
    roomToSockets[room].delete(socket);

    // Note: Don't use socket anymore, might not exist if disconnecting
    return (async () => {
      try {
        await database.ref(`rooms/${room}/users/${uid}`).remove();

        // Delete impromptu room
        const roomDoc = (
          await database.ref(`rooms/${room}`).once('value')
        ).val();
        if (!roomDoc.users && !roomDoc.permanent) {
          await database.ref(`rooms/${room}`).remove();
        }
      } catch (ignored) {}
    })();
  }

  function getRooms() {
    return Object.keys(socket.rooms).filter((room) => room !== socket.id);
  }

  function leaveAllRooms() {
    const rooms = getRooms();
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

    if (getRooms().length > 0) {
      await leaveAllRooms();
    }

    socket.join(room);
    socket.emit(`joined`, { room });

    if (!roomToSockets[room]) roomToSockets[room] = new Set();

    // Already joined
    if (roomToSockets[room].has(socket)) {
      return;
    }

    console.log(`[${room}] add peer`, socket.id);
    socket.to(room).emit('addPeer', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      shouldCreateOffer: false,
    });
    const peerSockets = roomToSockets[room];
    for (const peerSocket of peerSockets) {
      console.log(`[${socket.id}] add peer`, peerSocket.id);
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
    if (!peerSocket) {
      console.error(
        `[${socket.id}] relay ICE-candidate failed, invalid peerUid`,
        peerUid
      );
      return;
    }
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
    if (!peerSocket) {
      console.error(
        `[${socket.id}] relay SessionDescription failed, invalid peerUid`,
        peerUid
      );
      return;
    }

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
