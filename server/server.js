const express = require('express');
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

async function deleteFirebaseRoom(room) {
  await admin.database().ref(`rooms/${room}`).remove();
  await admin.database().ref(`musicSync/${room}`).remove();
}

async function cleanUpRooms() {
  const rooms = (await admin.database().ref('rooms').once('value')).val();
  for (const [room, roomDoc] of Object.entries(rooms)) {
    // Delete temporary rooms
    if (!roomDoc.permanent) {
      await deleteFirebaseRoom(room);
    }
    // Clear users from permanent rooms
    if (roomDoc.permanent) {
      await admin.database().ref(`rooms/${room}/users`).remove();
    }
  }
}
cleanUpRooms();

// Get PORT from env variable else assign 3000 for development
const PORT = isDevelopment ? process.env.PORT || 3010 : 8443;
server.listen(PORT, null, function () {
  console.log('Listening on port ' + PORT);
});

const uidToSocket = {};

function getRooms(socket) {
  return Object.keys(socket.rooms).filter((room) => room !== socket.id);
}

function getPeersInRoom(socket, room) {
  const roomObj = io.sockets.adapter.rooms[room];
  if (roomObj) {
    return Object.keys(roomObj.sockets)
      .filter((id) => id !== socket.id)
      .map((peerId) => io.sockets.sockets[peerId]);
  } else {
    return [];
  }
}

function leaveRoom(socket, room) {
  console.log(`[${socket.id}] leave room ${room}`);
  const database = admin.database();

  const uid = socket.user.uid;

  // tell peers to remove this
  socket.to(room).emit('removePeer', {
    peerSocketId: socket.id,
    peerUid: uid,
  });

  // tell this to remove each peer
  const peers = getPeersInRoom(socket, room);
  for (const peerSocket of peers) {
    socket.emit('removePeer', {
      peerSocketId: peerSocket.id,
      peerUid: peerSocket.user.uid,
    });
  }

  socket.leave(room);

  // Note: Don't use socket anymore, might not exist if disconnecting
  return (async () => {
    try {
      await database.ref(`rooms/${room}/users/${uid}`).remove();

      // Delete temporary room if no users left
      const roomDoc = (await database.ref(`rooms/${room}`).once('value')).val();
      if (!roomDoc.users && !roomDoc.permanent) {
        await deleteFirebaseRoom(room);
      }
    } catch (ignored) {}
  })();
}

async function leaveAllRoomsAsync(socket) {
  const rooms = getRooms(socket);
  console.log(`[${socket.id}] leaving all rooms`);
  return Promise.all(rooms.map((room) => leaveRoom(socket, room)));
}

function leaveAllRooms(socket) {
  const rooms = getRooms(socket);
  console.log(`[${socket.id}] leaving all rooms`);
  for (const room of rooms) {
    leaveRoom(socket, room);
  }
}

io.use(async (socket, next) => {
  const { idToken } = socket.handshake.query;
  try {
    console.log('verifying id token');
    socket.user = await admin.auth().verifyIdToken(idToken);
    const uid = socket.user.uid;
    if (uid in uidToSocket) {
      console.log(
        `[${socket.id}] uid already connected, kicking ${uidToSocket[uid].id}`
      );
      uidToSocket[uid].disconnect(true);
    }
    uidToSocket[uid] = socket;
    console.log('token verified');
    next();
  } catch (e) {
    next(new Error('forbidden'));
  }
});

io.on('connection', (socket) => {
  // const socketHostName = socket.handshake.headers.host.split(':')[0];
  console.log(`[${socket.id}] event:connection`);

  socket.on('disconnect', () => {
    console.log(`[${socket.id}] event:disconnect`);
  });

  socket.on('disconnecting', () => {
    console.log(`[${socket.id}] event:disconnecting`);
    if (
      socket.user.uid in uidToSocket &&
      uidToSocket[socket.user.uid].id === socket.id
    ) {
      delete uidToSocket[socket.user.uid];
    }
    leaveAllRooms(socket);
  });

  socket.on('join', async (msg) => {
    console.log(`[${socket.id}] event:join `, msg);
    const { room } = msg;
    if (room in socket.rooms) {
      // Already joined
      return;
    }

    await leaveAllRoomsAsync(socket);

    socket.join(room);
    socket.emit(`joined`, { room });

    // tell peers to add this
    console.log(`[${room}] add peer`, socket.id);
    socket.to(room).emit('addPeer', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      shouldCreateOffer: false,
    });

    // tell this to add each peer
    const peers = getPeersInRoom(socket, room);
    for (const peerSocket of peers) {
      console.log(`[${socket.id}] add peer`, peerSocket.id);
      socket.emit('addPeer', {
        peerSocketId: peerSocket.id,
        peerUid: peerSocket.user.uid,
        shouldCreateOffer: true,
      });
    }
  });

  socket.on('leave', async () => {
    console.log(`[${socket.id}] event:leave`);
    await leaveAllRooms(socket);
    socket.emit('left');
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
      `[${socket.id}] relay SessionDescription to [${peerSocket.id}]: `,
      sessionDescription.type
    );

    socket.to(peerSocket.id).emit('sessionDescription', {
      peerSocketId: socket.id,
      peerUid: socket.user.uid,
      sessionDescription: sessionDescription,
    });
  });
});
