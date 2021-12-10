const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const fetch = require('node-fetch');
const config = require('./config');

const adminSecret = config.HASURA_ADMIN_SECRET;
const hasuraEndpoint = config.HASURA_ENDPOINT;

const gql = (str) => str[0];

const query = gql`
  mutation (
    $status: user_status_enum
    $room_id: uuid
    $name: String
    $id: String
  ) {
    insert_users(
      objects: { id: $id, name: $name, status: $status, room_id: $room_id }
      on_conflict: {
        constraint: users_pkey
        update_columns: [status, name, room_id]
      }
    ) {
      affected_rows
    }
  }
`;

// On sign up.
exports.processSignUp = functions.auth.user().onCreate(async (user) => {
  console.log(user);
  // Check if user meets role criteria:
  // Your custom logic here: to decide what roles and other `x-hasura-*` should the user get
  const customClaims = {
    'https://hasura.io/jwt/claims': {
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': ['user'],
      'x-hasura-user-id': user.uid,
    },
  };

  const qv = {
    status: 'OFFLINE',
    room_id: null,
    name: user.displayName,
    id: user.uid,
  };
  await fetch(hasuraEndpoint, {
    method: 'POST',
    body: JSON.stringify({ query: query, variables: qv }),
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
  });

  // Set custom user claims on this newly created user.
  return admin
    .auth()
    .setCustomUserClaims(user.uid, customClaims)
    .then(() => {
      // Update real-time database to notify client to force refresh.
      const metadataRef = admin.database().ref('metadata/' + user.uid);
      // Set the refresh time to the current UTC timestamp.
      // This will be captured on the client to force a token refresh.
      return metadataRef.set({ refreshTime: new Date().getTime() });
    })
    .catch((error) => {
      console.log(error);
    });
});
