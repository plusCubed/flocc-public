import React, { useMemo, useState, Suspense, useTransition } from 'react';
import {
  useDatabase,
  useDatabaseListData,
  useDatabaseObjectData,
  useUser,
} from 'reactfire';
import { useDatabaseObjectDataPartial } from '../hooks/useDatabaseObjectDataPartial';
import { AddFriendIcon, ClockIcon } from './icons';

export function Friends() {
  const uid = useUser().uid;
  const database = useDatabase();
  const friendsData = useDatabaseObjectData(
    database.ref('friendships').child(uid)
  );
  const friendUids = useMemo(() => Object.keys(friendsData), [friendsData]);

  const friendDocs = useDatabaseObjectDataPartial('users', friendUids);

  return (
    <div>
      {friendDocs
        ? Object.entries(friendDocs).map(([friendUid, friendDoc]) => (
            <div key={friendUid}>{friendDoc.displayName}</div>
          ))
        : null}
    </div>
  );
}

export function FriendRequests() {
  const uid = useUser().uid;
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
  const requestUserDocs =
    useDatabaseObjectDataPartial('users', requestUids) || {};

  console.log(requestUserDocs);

  const confirmRequest = (otherUid) => {
    database.ref('friendships').child(uid).child(otherUid).set(true);
    database.ref('friendships').child(otherUid).child(uid).set(true);
    database.ref('friendRequests').child(uid).child(otherUid).remove();
    database.ref('friendRequests').child(otherUid).child(uid).remove();
  };

  return Object.entries(requestUserDocs).length > 0 ? (
    <div className="mb-3">
      <div className="text-sm font-bold">Requests</div>
      {Object.entries(requestUserDocs).map(([requestUid, requestUserDoc]) => (
        <div key={requestUid} className="flex items-center">
          <div className="font-normal text-sm">
            {requestUserDoc.displayName}
          </div>
          <div
            onClick={() => confirmRequest(requestUid)}
            className="focus:outline-none rounded bg-teal-600 hover:bg-teal-700 active:bg-teal-800 self-center p-0.5 ml-1"
          >
            <AddFriendIcon className="h-5 w-5 text-gray-100" />
          </div>
        </div>
      ))}
    </div>
  ) : null;
}

function SearchList({ searchString }) {
  const uid = useUser().uid;
  const database = useDatabase();

  const friendsData = useDatabaseObjectData(
    database.ref('friendships').child(uid)
  );
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
  console.log(results, uid);
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
          <div className="font-normal text-sm">{displayName}</div>
          {friendRequests[otherUid] !== 'OUTGOING' ? (
            <div
              onClick={() => {
                requestFriend(otherUid);
              }}
              className="focus:outline-none rounded text-gray-700 hover:bg-gray-200 active:bg-gray-300 self-center p-0.5 ml-1"
            >
              <AddFriendIcon className="h-5 w-5 text-gray-600" />
            </div>
          ) : (
            <div className="focus:outline-none rounded text-gray-700 self-center p-0.5 ml-1">
              <ClockIcon className="h-5 w-5 text-gray-400" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PeopleSearch() {
  const uid = useUser().uid;
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
      <div className="text-sm font-bold mb-1">Add Friend</div>
      <div className="rounded bg-gray-100 border-0 mb-1">
        <input
          className="w-full py-1 px-2 flex-1 block text-sm bg-transparent border-0 ring-0 focus:border-0 focus:ring-0"
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
