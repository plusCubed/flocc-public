import { useEffect, useState } from 'react';

import { useDatabase } from 'reactfire';
import { useDatabaseObjectData as useReactfireDatabaseObjectData } from 'reactfire';
import { useDatabaseListData as useReactfireDatabaseListData } from 'reactfire';

export function useDatabaseObjectData(ref, options) {
  const data = useReactfireDatabaseObjectData(ref, options).data ?? {};
  delete data['NO_ID_FIELD'];
  return data;
}

export function useDatabaseListData(ref, options) {
  const data = useReactfireDatabaseListData(ref, options).data ?? [];
  delete data['NO_ID_FIELD'];
  return data;
}

/**
 * @param {string} path
 * @param {[string]} childKeys
 * @returns {Object.<string, Object> | null}
 */
export function useDatabaseObjectDataPartial(path, childKeys) {
  const [objectData, setObjectData] = useState({});

  const database = useDatabase();
  useEffect(() => {
    let listeners = {};

    // remove data no longer in childKeys
    setObjectData((objectData) => {
      if (objectData === null) return null;
      const newObjectData = {};
      for (const key of Object.keys(objectData)) {
        if (childKeys.includes(key)) {
          newObjectData[key] = objectData[key];
        }
      }
      return newObjectData;
    });

    for (const childKey of childKeys) {
      listeners[childKey] = (snapshot) => {
        setObjectData((objectData) => {
          const value = snapshot.val();
          if (value) {
            return {
              ...objectData,
              [snapshot.key]: value,
            };
          } else {
            return objectData;
          }
        });
      };
      database.ref(path).child(childKey).on('value', listeners[childKey]);
    }

    return () => {
      for (const childKey of childKeys) {
        database.ref(path).child(childKey).off('value', listeners[childKey]);
      }
    };
  }, [childKeys, database, path]);

  return objectData;
}
