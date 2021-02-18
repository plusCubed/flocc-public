import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import ReactPlayer from 'react-player/youtube';
import isElectron from 'is-electron';
import {
  useDatabase,
  useDatabaseListData,
  useDatabaseObjectData,
} from 'reactfire';
import { usePrevious } from '../util/usePrev';
import { Button, MusicIcon, SectionLabel, SpeakerIcon } from './ui';

export function Music({ currentRoomId }) {
  const config = useMemo(() => {
    return {
      youtube: {
        playerVars: {
          fs: 0,
        },
      },
    };
  }, []);

  const playerRef = useRef(null);

  const [queryLoading, setQueryLoading] = useState('');

  const database = useDatabase();
  const handleSearchInput = useCallback(
    async (e) => {
      if (!isElectron()) {
        alert('Music is only available in the desktop app.');
        return;
      }

      const query = e.target.value;
      // ENTER
      if (e.keyCode === 13 && query) {
        e.target.value = '';
        setQueryLoading(query);
        const ytsr = require('ytsr');
        try {
          const filters1 = await ytsr.getFilters(query);
          const filter1 = filters1.get('Type').get('Video');
          const options = {
            limit: 1,
          };
          const searchResults = await ytsr(filter1.url, options);
          if (searchResults.items && searchResults.items[0]) {
            setQueryLoading('');
            const result = searchResults.items[0];
            await database
              .ref(`rooms/${currentRoomId}/music`)
              .child(`${Math.floor(Date.now() / 1000)}`)
              .set({
                title: result.title,
                url: result.url,
                duration: result.duration,
                isLive: result.isLive,
              });
          }
        } catch (e) {
          setQueryLoading('');
        }
      }
    },
    [currentRoomId, database]
  );

  const [volume, setVolume] = useState(0);
  useEffect(() => {
    const initialVolume = localStorage.getItem('musicVolume');
    setVolume(parseInt(initialVolume));
  }, []);
  useEffect(() => {
    localStorage.setItem('musicVolume', volume.toString());
  }, [volume]);
  const handleVolumeInput = useCallback((e) => {
    setVolume(parseInt(e.currentTarget.value));
  }, []);

  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState('');

  const queue = useDatabaseListData(
    database.ref(`rooms/${currentRoomId}/music`).orderByKey(),
    { idField: 'queueId' }
  );
  const prevQueue = usePrevious(queue);
  useEffect(() => {
    if (prevQueue?.[0]?.queueId !== queue?.[0]?.queueId) {
      setUrl(queue?.[0]?.url);
      setPlaying(true);
    }
  }, [prevQueue, queue]);

  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      const currentQueueId = queue[0].queueId;
      database.ref(`rooms/${currentRoomId}/music/${currentQueueId}`).remove();
      database
        .ref(`rooms/${currentRoomId}/currentMusic/${currentQueueId}`)
        .remove();
    }
  }, [currentRoomId, database, queue]);

  const handlePlayerProgress = useCallback(
    ({ played, playedSeconds, loaded, loadedSeconds }) => {
      database
        .ref(`rooms/${currentRoomId}/currentMusic`)
        .child(`${queue[0].queueId}/playedSeconds`)
        .set(playedSeconds);
    },
    [currentRoomId, database, queue]
  );

  return (
    <div className="pt-2 border-t border-solid border-gray-200">
      <div hidden={!url}>
        <div className="aspect-w-16 aspect-h-9">
          <ReactPlayer
            height="100%"
            width="100%"
            url={url}
            config={config}
            ref={playerRef}
            playing={playing}
            controls={true}
            volume={volume / 100}
            onEnded={handleNext}
            onProgress={handlePlayerProgress}
          />
        </div>

        <div className="flex flex-row py-1 items-center">
          <MusicIcon className="mr-2" width={20} height={20} />
          <input
            className="flex-1 outline-none text-sm rounded-lg overflow-hidden appearance-none bg-gray-400 h-2"
            type="range"
            min="0"
            max="100"
            value={volume.toString()}
            onInput={handleVolumeInput}
          />

          <div className="flex-1" />

          <Button className="text-sm" onClick={handleNext}>
            Next
          </Button>
        </div>
      </div>

      <ul className="mb-1">
        {queue.map((vid) => {
          return (
            <li key={vid.queueId} className="truncate text-gray-700">
              <span className="select-none">• </span>
              <a
                href={vid.url}
                className="hover:text-blue-500 hover:underline text-sm"
                title={vid.title}
              >
                {vid.title}
              </a>
            </li>
          );
        })}
        <li className="truncate text-gray-500" hidden={!queryLoading}>
          <span className="select-none">• </span>
          <span className="text-gray-400">{queryLoading}</span>
        </li>
      </ul>

      <div className="flex flex-row mt-1 rounded bg-gray-100 border-0">
        <input
          className="py-1 px-2 flex-1 block text-sm bg-transparent border-0 ring-0 focus:border-0 focus:ring-0"
          placeholder="Search & queue music"
          type="text"
          onKeyUp={handleSearchInput}
          disabled={queryLoading}
        />
      </div>
    </div>
  );
}
