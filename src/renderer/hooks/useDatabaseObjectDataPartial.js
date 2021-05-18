import { useEffect, useState } from 'react';
import { useDatabase } from 'reactfire';

/**
 * @param {string} path
 * @param {[string]} childKeys
 * @returns {Object.<string, Object> | null}
 */
export function useDatabaseObjectDataPartial(path, childKeys) {
  const [objectData, setObjectData] = useState(null);

  const database = useDatabase();
  useEffect(() => {
    let listeners = {};

    // remove data no longer in childKeys
    setObjectData((objectData) => {
      if (objectData === null) return null;
      const newObjectData = {};
      for (const key of Object.keys(objectData)) {
        if (key in childKeys) {
          newObjectData[key] = objectData[key];
        }
      }
      return newObjectData;
    });

    for (const childKey of childKeys) {
      listeners[childKey] = (snapshot) => {
        setObjectData((objectData) => ({
          ...objectData,
          [snapshot.key]: snapshot.val(),
        }));
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
