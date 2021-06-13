import React, { useMemo, useState, Suspense, useTransition } from 'react';

import { useDatabase, useUser } from 'reactfire';

import {
  useDatabaseListData,
  useDatabaseObjectData,
  useDatabaseObjectDataPartial,
} from '../hooks/useDatabase';
import { useUid } from '../hooks/useUid';

import { AddFriendIcon, ClockIcon } from './icons';

export function Friends() {
  const uid = useUid();
  const database = useDatabase();
  const friendsData = useDatabaseObjectData(database.ref('friends').child(uid));
  const friendUids = useMemo(() => Object.keys(friendsData), [friendsData]);

  const friendDocs = useDatabaseObjectDataPartial('users', friendUids);

  return (
    <div className="mb-3">
      <div className="text-sm font-bold">Friends</div>
      {friendDocs
        ? Object.entries(friendDocs).map(([friendUid, friendDoc]) => (
            <div key={friendUid} className="text-sm font-normal">
              {friendDoc.displayName}
            </div>
          ))
        : null}
    </div>
  );
}

export function FriendRequests() {
  const uid = useUid();
  const database = useDatabase();

  const friendRequests = useDatabaseObjectData(
    database.ref('friendRequests').child(uid)
  );
  const requestUids = useMemo(
    () =>
      Object.entries(friendRequests)
        .filter(([otherUid, status]) => {
          return status === 'INCOMING';
        })
        .map(([otherUid, status]) => {
          return otherUid;
        }),
    [friendRequests]
  );
  const requestUserDocs = useDatabaseObjectDataPartial('users', requestUids);

  const confirmRequest = (otherUid) => {
    database.ref('friends').child(uid).child(otherUid).set(true);
    database.ref('friends').child(otherUid).child(uid).set(true);
    database.ref('friendRequests').child(uid).child(otherUid).remove();
    database.ref('friendRequests').child(otherUid).child(uid).remove();
  };

  return Object.entries(requestUserDocs).length > 0 ? (
    <div className="mb-3">
      <div className="text-sm font-bold">Requests</div>
      {Object.entries(requestUserDocs).map(([requestUid, requestUserDoc]) => (
        <div key={requestUid} className="flex items-center">
          <div className="text-sm font-normal">
            {requestUserDoc.displayName}
          </div>
          <div
            onClick={() => confirmRequest(requestUid)}
            className="focus:outline-none rounded bg-teal-600 hover:bg-teal-700 active:bg-teal-800 self-center p-0.5 ml-1"
          >
            <AddFriendIcon className="w-5 h-5 text-gray-100" />
          </div>
        </div>
      ))}
    </div>
  ) : null;
}

function SearchList({ searchString }) {
  const uid = useUid();
  const database = useDatabase();

  const friendsData = useDatabaseObjectData(database.ref('friends').child(uid));
  const friendUids = useMemo(() => Object.keys(friendsData), [friendsData]);

  const friendRequests = useDatabaseObjectData(
    database.ref('friendRequests').child(uid)
  );

  const query = database
    .ref('users')
    .orderByChild('displayName')
    .startAt(searchString)
    .endAt(searchString + '\uf8ff')
    .limitToFirst(20);
  const results = useDatabaseListData(query, { idField: 'uid' });
  const potentialFriends = results.filter(({ uid: otherUid, displayName }) => {
    // not self, not already friend
    return uid !== otherUid && !friendUids.includes(otherUid);
  });

  const requestFriend = (otherUid) => {
    database.ref('friendRequests').child(uid).child(otherUid).set('OUTGOING');
    database.ref('friendRequests').child(otherUid).child(uid).set('INCOMING');
  };

  return (
    <div>
      {potentialFriends?.map(({ uid: otherUid, displayName }) => (
        <div key={otherUid} className="flex items-center">
          <div className="text-sm font-normal">{displayName}</div>
          {friendRequests[otherUid] !== 'OUTGOING' ? (
            <div
              onClick={() => {
                requestFriend(otherUid);
              }}
              className="focus:outline-none rounded text-gray-700 hover:bg-gray-200 active:bg-gray-300 self-center p-0.5 ml-1"
            >
              <AddFriendIcon className="w-5 h-5 text-gray-600" />
            </div>
          ) : (
            <div className="focus:outline-none rounded text-gray-700 self-center p-0.5 ml-1">
              <ClockIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PeopleSearch() {
  const uid = useUid();
  const database = useDatabase();

  const [searchString, setSearchString] = useState('');

  const [isPending, startTransition] = useTransition({
    timeoutMs: 500,
  });
  const handleChange = (event) => {
    startTransition(() => {
      setSearchString(event.target.value);
    });
  };

  return (
    <div>
      <div className="mb-1 text-sm font-bold">Add Friend</div>
      <div className="mb-1 bg-gray-100 rounded border-0">
        <input
          className="block flex-1 py-1 px-2 w-full text-sm bg-transparent border-0 ring-0 focus:border-0 focus:ring-0"
          placeholder="Search"
          type="text"
          value={searchString}
          onChange={handleChange}
        />
      </div>
      <Suspense fallback={<div>Loading</div>}>
        <SearchList searchString={searchString} />
      </Suspense>
    </div>
  );
}
