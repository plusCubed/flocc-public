import { useEffect, useState } from 'react';
import { useDatabase } from 'reactfire';

export function useDatabaseObjectDataPartial(path, childKeys) {
  const [objectData, setObjectData] = useState(null);

  const database = useDatabase();
  useEffect(() => {
    let cancelled = false;

    async function updateObjectData() {
      /** @type firebase.database.DataSnapshot[] */
      const docSnapshots = await Promise.all(
        childKeys.map((key) => database.ref(path).child(key).once('value'))
      );
      const objectData = {};
      for (const snapshot of docSnapshots) {
        objectData[snapshot.key] = snapshot.val();
      }
      if (!cancelled) setObjectData(objectData);
    }

    updateObjectData();

    return () => {
      cancelled = true;
    };
  }, [childKeys, database, path]);

  return objectData;
}
