import React, { useCallback } from 'react';

import { useDatabase } from 'reactfire';

import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { useUid } from '../hooks/useUid';

import { MatMicrophoneIcon, MatMicrophoneOffIcon } from './icons';

export function MuteButton({ roomId, socket }) {
  const database = useDatabase();
  const uid = useUid();
  const mute = useDatabaseObjectData(database.ref(`users/${uid}/mute`));
  const toggleMute = useCallback(() => {
    socket.emit('toggle_mute');
  }, [socket]);

  const roomUserCount = useDatabaseListData(
    database.ref(`rooms/${roomId}/users`)
  ).length;

  const enabled = roomUserCount > 1;
  return (
    <button
      className={`has-tooltip p-1 ml-1 rounded focus:outline-none ${
        enabled ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400'
      }`}
      onClick={toggleMute}
      disabled={!enabled}
    >
      {mute ? (
        <MatMicrophoneOffIcon width={20} height={20} />
      ) : (
        <MatMicrophoneIcon width={20} height={20} />
      )}
      <div className="tooltip rounded shadow-lg p-2 px-4 text-gray-700 bg-gray-100 mt-2 whitespace-pre">
        To control mute,{'\n'}get in a call!
      </div>
    </button>
  );
}
