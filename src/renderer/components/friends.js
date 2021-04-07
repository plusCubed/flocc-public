import React, { useMemo, useState } from 'react';
import {
  useDatabase,
  useDatabaseListData,
  useDatabaseObjectData,
  useUser,
} from 'reactfire';
import { useDatabaseObjectDataPartial } from '../hooks/useDatabaseObjectDataPartial';

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

export function PeopleSearch() {
  const uid = useUser().uid;
  const database = useDatabase();

  const [searchString, setSearchString] = useState('');

  const query = database
    .ref('users')
    //.startAt(searchString, 'displayName')
    .limitToFirst(20);
  const allUsers = useDatabaseListData(query, { idField: 'uid' });

  return (
    <div>
      {allUsers?.map(({ uid, displayName }) => (
        <div key={uid}>{displayName}</div>
      ))}
    </div>
  );
}
