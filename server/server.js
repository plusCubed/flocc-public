import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import https from 'https';
import admin from 'firebase-admin';
import fs from 'fs';
import serviceAccount from './service-account.json';
import RoomState from '../common/roomState.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

const app = express();
const httpServer = isDevelopment
  ? http.createServer(app)
  : https.createServer(
      {
        key: fs.readFileSync('cert/key.pem', 'utf8'),
        cert: fs.readFileSync('cert/cert.pem', 'utf8'),
      },
      app
    );
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
  allowEIO3: true,
});
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://floccapp.firebaseio.com',
});

const database = admin.database();

async function deleteFirebaseRoom(room) {
  await database.ref(`rooms/${room}`).remove();
  await database.ref(`musicSync/${room}`).remove();
}

async function cleanUpRooms() {
  const rooms = (await database.ref('rooms').once('value')).val();
  if (!rooms) return;
  for (const [room, roomDoc] of Object.entries(rooms)) {
    // Delete temporary rooms
    if (!roomDoc.permanent) {
      await deleteFirebaseRoom(room);
    }
    // Clear users from permanent rooms
    if (roomDoc.permanent) {
      await database.ref(`rooms/${room}/users`).remove();
    }
  }
}
cleanUpRooms().then();

// Get PORT from env variable else assign 3000 for development
const PORT = isDevelopment ? process.env.PORT || 3010 : 8443;
httpServer.listen(PORT, null, function () {
  console.log('Listening on port ' + PORT);
});

/**
 * @type {Object.<string, Socket>}
 */
const uidToSocket = {};

/**
 * @param {Socket} socket
 * @return {[string]}
 */
function getRooms(socket) {
  const rooms = new Set(socket.rooms);
  rooms.delete(socket.id);
  return Array.from(rooms);
}

/**
 * @param {Socket} socket
 * @param {string} room
 * @return {Socket[]}
 */
function getPeersInRoom(socket, room) {
  const socketIds = new Set(io.of('/').adapter.rooms.get(room));
  socketIds.delete(socket.id);
  return Array.from(socketIds).map((socketId) =>
    io.of('/').sockets.get(socketId)
  );
}

/**
 * @param {Socket} socket
 * @param {string} room
 * @returns {Promise<void>}
 */
function leaveRoom(socket, room) {
  console.log(`[${socket.id}] leave room ${room}`);
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
      // Delete room if no users left
      const roomDoc = (await database.ref(`rooms/${room}`).once('value')).val();
      if (!roomDoc.users && !roomDoc.permanent) {
        await deleteFirebaseRoom(room);
      }
      await database.ref(`users/${uid}/room`).set('');
    } catch (ignored) {}
  })();
}

/**
 * @param {Socket} socket
 */
async function leaveAllRoomsAsync(socket) {
  const rooms = getRooms(socket);
  if (rooms.length > 0) {
    console.log(`[${socket.id}] leaving all rooms`);
    await Promise.all(rooms.map((room) => leaveRoom(socket, room)));
  }
}

/**
 * @param {Socket} socket
 */
function leaveAllRooms(socket) {
  const rooms = getRooms(socket);
  if (rooms.length > 0) {
    console.log(`[${socket.id}] leaving all rooms`);
    for (const room of rooms) {
      leaveRoom(socket, room).then();
    }
  }
}

io.use(async (socket, next) => {
  const { idToken } = socket.handshake.query;
  try {
    console.log(`[${socket.id}] verifying id token`);
    socket.user = await admin.auth().verifyIdToken(idToken);
    const uid = socket.user.uid;
    if (uid in uidToSocket) {
      console.log(
        `[${socket.id}] uid already connected, kicking ${uidToSocket[uid].id}`
      );
      uidToSocket[uid].disconnect(true);
    }
    uidToSocket[uid] = socket;
    console.log(`[${socket.id}] token verified`);
    next();
  } catch (e) {
    next(new Error('forbidden'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.user.uid;

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
    database.ref(`users/${uid}/roomState`).set(RoomState.NONE);
  });

  socket.on('join', async (msg) => {
    console.log(`[${socket.id}] event:join `, msg);
    let { room, locked } = msg;
    if (room in socket.rooms) {
      return; // Already joined
    }
    await leaveAllRoomsAsync(socket);

    if (!room) {
      const roomRef = await database.ref(`rooms`).push({ locked: !!locked });
      room = roomRef.key;
    }
    database.ref(`rooms/${room}/users/${uid}`).set(true).then();
    database.ref(`users/${uid}/room`).set(room).then();
    database.ref(`users/${uid}/roomState`).set(RoomState.JOINED).then();

    socket.join(room);
    socket.emit(`joined`, { room });

    // tell peers to add this
    console.log(`[${room}] add peer`, socket.id);
    socket.to(room).emit('addPeer', {
      peerSocketId: socket.id,
      peerUid: uid,
    });

    // tell this to add each peer
    const peers = getPeersInRoom(socket, room);
    for (const peerSocket of peers) {
      console.log(`[${socket.id}] add peer`, peerSocket.id);
      socket.emit('addPeer', {
        peerSocketId: peerSocket.id,
        peerUid: peerSocket.user.uid,
      });
    }
  });

  socket.on('leave', async () => {
    console.log(`[${socket.id}] event:leave`);
    await leaveAllRoomsAsync(socket);
    await database.ref(`users/${uid}/roomState`).set(RoomState.NONE);
    socket.emit('left');
  });

  socket.on('signal', (msg) => {
    const { peerUid, data } = msg;
    const peerSocket = uidToSocket[peerUid];
    if (!peerSocket) {
      console.error(`[${socket.id}] signal failed, invalid peerUid`, peerUid);
      return;
    }
    console.log(`[${socket.id}] signal to [${peerSocket.id}]`);

    socket.to(peerSocket.id).emit('signal', {
      peerSocketId: socket.id,
      peerUid: uid,
      data,
    });
  });
});
