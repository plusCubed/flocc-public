import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import https from 'https';
import admin from 'firebase-admin';
import fs from 'fs';
import packageJson from './package.json';
import serviceAccount from './service-account.json';

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

async function cleanUp() {
  const rooms = (await database.ref('rooms').once('value')).val();
  if (rooms) {
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
  const users = (await database.ref('users').once('value')).val();
  if (users) {
    for (const [userId, userDoc] of Object.entries(users)) {
      await database.ref(`users/${userId}/room`).set('');
      await database.ref(`users/${userId}/status`).set('OFFLINE');
    }
  }
}
await cleanUp();

function info(obj) {
  console.info(new Date().toISOString(), obj);
}

function log(obj) {
  console.log(new Date().toISOString(), obj);
}

// Get PORT from env variable else assign 3000 for development
const PORT = isDevelopment ? process.env.PORT || 3010 : 8443;
httpServer.listen(PORT, null, function () {
  log('Listening on port ' + PORT);
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

const AddPeerType = {
  OTHER_JOINING: 'OTHER_JOINING',
  ME_JOINING: 'ME_JOINING',
};

const RemovePeerType = {
  OTHER_LEAVING: 'OTHER_LEAVING',
  ME_LEAVING: 'ME_LEAVING',
};

// create new room if room is null - mutes if so
// otherwise, unmute & join
async function joinRoom(room, locked, socket) {
  const uid = socket.user.uid;
  if (room in socket.rooms) {
    return; // Already joined
  }
  await leaveAllRoomsAsync(socket);

  if (!room) {
    const roomRef = await database.ref(`rooms`).push({ locked: !!locked });
    room = roomRef.key;
    await database.ref(`users/${uid}/mute`).set(true);
  } else {
    await database.ref(`users/${uid}/mute`).set(false);
  }
  await database.ref(`rooms/${room}/users/${uid}`).set(true);
  await database.ref(`users/${uid}/room`).set(room);

  socket.join(room);
  socket.emit(`joined`, { room });

  // tell peers to add this
  log(`[room ${room}] add peer`, socket.id);
  socket.to(room).emit('addPeer', {
    peerSocketId: socket.id,
    peerUid: uid,
    type: AddPeerType.OTHER_JOINING,
  });

  // tell this to add each peer
  const peers = getPeersInRoom(socket, room);
  for (const peerSocket of peers) {
    log(`[${socket.id}] add peer`, peerSocket.id);
    socket.emit('addPeer', {
      peerSocketId: peerSocket.id,
      peerUid: peerSocket.user.uid,
      type: AddPeerType.ME_JOINING,
    });
  }
}

/**
 * @param {Socket} socket
 * @param {string} room
 * @returns {Promise<void>}
 */
function leaveRoom(socket, room) {
  log(`[${socket.id}] leave room ${room}`);
  const uid = socket.user.uid;

  // tell peers to remove this
  socket.to(room).emit('removePeer', {
    peerSocketId: socket.id,
    peerUid: uid,
    type: RemovePeerType.OTHER_LEAVING,
  });

  // tell this to remove each peer
  const peers = getPeersInRoom(socket, room);
  for (const peerSocket of peers) {
    socket.emit('removePeer', {
      peerSocketId: peerSocket.id,
      peerUid: peerSocket.user.uid,
      type: RemovePeerType.ME_LEAVING,
    });
  }

  socket.leave(room);

  // Note: Don't use socket anymore, might not exist if disconnecting
  return (async () => {
    try {
      await database.ref(`rooms/${room}/users/${uid}`).remove();
      await database.ref(`users/${uid}/room`).set('');
      // Delete room if no users left
      const roomDoc = (await database.ref(`rooms/${room}`).once('value')).val();
      if (roomDoc && !roomDoc.users && !roomDoc.permanent) {
        await deleteFirebaseRoom(room);
      }
    } catch (e) {
      console.error(e);
    }
  })();
}

/**
 * @param {Socket} socket
 */
async function leaveAllRoomsAsync(socket) {
  const rooms = getRooms(socket);
  if (rooms.length > 0) {
    log(`[${socket.id}] leaving all rooms`);
    await Promise.all(rooms.map((room) => leaveRoom(socket, room)));
  }
}

/**
 * @param {Socket} socket
 */
function leaveAllRooms(socket) {
  const rooms = getRooms(socket);
  if (rooms.length > 0) {
    log(`[${socket.id}] leaving all rooms`);
    for (const room of rooms) {
      leaveRoom(socket, room).then();
    }
  }
}

io.use(async (socket, next) => {
  const { version } = socket.handshake.query;
  if (version === packageJson.version) {
    next();
  } else {
    log(
      `Wrong protocol version: ${packageJson.version} required, requested ${version}`
    );
    next(new Error('protocol_version'));
  }
});

io.use(async (socket, next) => {
  const { idToken } = socket.handshake.query;
  try {
    log(`[${socket.id}] verifying id token`);
    socket.user = await admin.auth().verifyIdToken(idToken);
    const uid = socket.user.uid;
    if (uid in uidToSocket) {
      log(
        `[${socket.id}] uid already connected, kicking ${uidToSocket[uid].id}`
      );
      uidToSocket[uid].disconnect(true);
    }
    uidToSocket[uid] = socket;
    log(`[${socket.id}] token verified`);

    // set displayName in RTDB
    admin
      .auth()
      .getUser(uid)
      .then((user) => {
        return database.ref(`users/${uid}/displayName`).set(user.displayName);
      })
      .catch((e) => console.error(e));
    next();
  } catch (e) {
    next(new Error('forbidden'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.user.uid;

  // const socketHostName = socket.handshake.headers.host.split(':')[0];
  log(`[${socket.id}] event:connection`);
  database.ref(`users/${uid}/status`).set('IDLE');

  socket.on('disconnect', () => {
    log(`[${socket.id}] event:disconnect`);
    database.ref(`users/${uid}/status`).set('OFFLINE');
  });

  socket.on('disconnecting', () => {
    log(`[${socket.id}] event:disconnecting`);
    try {
      if (
        socket.user.uid in uidToSocket &&
        uidToSocket[socket.user.uid].id === socket.id
      ) {
        delete uidToSocket[socket.user.uid];
      }
      leaveAllRooms(socket);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('active', () => {
    log(`[${socket.id}] event:active`);
    database.ref(`users/${uid}/status`).set('ACTIVE');
  });

  socket.on('idle', async () => {
    log(`[${socket.id}] event:idle`);
    await database.ref(`users/${uid}/status`).set('IDLE');
  });

  socket.on('toggle_mute', async () => {
    log(`[${socket.id}] event:toggle_mute`);
    await database.ref(`users/${uid}/mute`).transaction((value) => {
      return !value;
    });
  });

  socket.on('join', async (msg) => {
    log(`[${socket.id}] event:join `, msg);
    const { room, locked } = msg;
    try {
      await joinRoom(room, locked, socket);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('leave', async () => {
    log(`[${socket.id}] event:leave`);
    try {
      await leaveAllRoomsAsync(socket);
    } catch (e) {
      console.error(e);
    }
    socket.emit('left');
  });

  socket.on('signal', (msg) => {
    try {
      const { peerUid, data } = msg;
      const peerSocket = uidToSocket[peerUid];
      if (!peerSocket) {
        console.error(`[${socket.id}] signal failed, invalid peerUid`, peerUid);
        return;
      }
      info(`[${socket.id}] signal to [${peerSocket.id}]`);

      socket.to(peerSocket.id).emit('signal', {
        peerSocketId: socket.id,
        peerUid: uid,
        data,
      });
    } catch (e) {
      console.error(e);
    }
  });
});
