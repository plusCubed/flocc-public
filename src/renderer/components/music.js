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
  useDatabaseObject,
  useDatabaseObjectData,
} from 'reactfire';
import { usePrevious } from '../util/usePrev';
import {
  Button,
  MusicIcon,
  SectionLabel,
  SettingsIcon,
  SkipNextIcon,
  SpeakerIcon,
} from './ui';

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

  const database = useDatabase();
  const handleSearchInput = useCallback(
    async (e) => {
      const query = e.target.value;
      // ENTER
      if (e.keyCode === 13 && query) {
        e.target.value = '';

        const queueId = Math.floor(Date.now() / 1000);
        await database
          .ref(`rooms/${currentRoomId}/music`)
          .child(`${queueId}`)
          .set({ query });

        const ytsr = require('ytsr');
        try {
          const filters1 = await ytsr.getFilters(query);
          const filter1 = filters1.get('Type').get('Video');
          const options = { limit: 1 };
          const searchResults = await ytsr(filter1.url, options);
          if (searchResults.items && searchResults.items[0]) {
            const result = searchResults.items[0];
            await database
              .ref(`rooms/${currentRoomId}/music`)
              .child(`${queueId}`)
              .set({
                title: result.title,
                url: result.url,
                duration: result.duration,
                isLive: result.isLive,
              });
            await database
              .ref(`rooms/${currentRoomId}/musicStatus`)
              .child(`${queueId}`)
              .set({
                playedSeconds: 0,
                playing: true,
              });
          } else {
            // TODO: display no search results
            await database
              .ref(`rooms/${currentRoomId}/music`)
              .child(`${queueId}`)
              .remove();
          }
        } catch (e) {
          console.error(e);
          // TODO: display error
          await database
            .ref(`rooms/${currentRoomId}/music`)
            .child(`${queueId}`)
            .remove();
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

  const [url, setUrl] = useState('');

  const queue = useDatabaseListData(
    database.ref(`rooms/${currentRoomId}/music`).orderByKey(),
    { idField: 'queueId' }
  );

  const playing =
    useDatabaseObjectData(
      database
        .ref(`rooms/${currentRoomId}/musicStatus`)
        .child(`${queue?.[0]?.queueId}` || 'invalid')
        .child('playing')
    ) === true;

  const prevQueue = usePrevious(queue);
  useEffect(() => {
    if (
      prevQueue?.[0]?.queueId !== queue?.[0]?.queueId ||
      prevQueue?.[0]?.url !== queue?.[0]?.url
    ) {
      if (queue?.[0]?.url) {
        if (prevQueue?.[0]?.url === queue?.[0]?.url) {
          setUrl(''); // clear player
        }

        setUrl(`${queue[0].url}`);
      } else {
        setUrl(null);
      }
    }
  }, [currentRoomId, database, prevQueue, queue]);

  const handleNext = useCallback(() => {
    if (queue.length > 0) {
      const currentQueueId = queue[0].queueId;
      database.ref(`rooms/${currentRoomId}/music/${currentQueueId}`).remove();
      database
        .ref(`rooms/${currentRoomId}/musicStatus/${currentQueueId}`)
        .remove();
    }
  }, [currentRoomId, database, queue]);

  const handlePlayerProgress = useCallback(
    ({ played, playedSeconds, loaded, loadedSeconds }) => {
      database
        .ref(`rooms/${currentRoomId}/musicStatus`)
        .child(`${queue[0].queueId}/playedSeconds`)
        .set(playedSeconds);
    },
    [currentRoomId, database, queue]
  );

  const handlePause = useCallback(() => {
    console.log('pause');
    database
      .ref(`rooms/${currentRoomId}/musicStatus`)
      .child(`${queue[0].queueId}/playing`)
      .set(false);
  }, [currentRoomId, database, queue]);

  const handlePlay = useCallback(() => {
    console.log('play');
    database
      .ref(`rooms/${currentRoomId}/musicStatus`)
      .child(`${queue[0].queueId}/playing`)
      .set(true);
  }, [currentRoomId, database, queue]);

  const handlePlayerReady = useCallback(() => {
    console.log('ready');
    // Seek to playedSeconds (if it exists)
    (async () => {
      const playedSeconds = (
        await database
          .ref(`rooms/${currentRoomId}/musicStatus`)
          .child(`${queue[0].queueId}`)
          .child('playedSeconds')
          .once('value')
      ).val();
      playerRef.current?.seekTo(playedSeconds, 'seconds');
    })();
  }, [currentRoomId, database, queue]);

  return (
    <div className="pt-2 border-t border-solid border-gray-200">
      <div className={url ? 'block' : 'hidden'}>
        <div className="aspect-w-16 aspect-h-9">
          <ReactPlayer
            height="100%"
            width="100%"
            url={url}
            config={config}
            ref={playerRef}
            playing={playing}
            controls={false}
            volume={volume / 100}
            onReady={handlePlayerReady}
            onEnded={handleNext}
            onPause={handlePause}
            onPlay={handlePlay}
            onBuffer={() => {
              console.log('buffer');
            }}
            onBufferEnd={() => {
              console.log('buffer end');
            }}
            onProgress={handlePlayerProgress}
            progressInterval={500}
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
            <SkipNextIcon width={18} height={18} />
          </Button>
        </div>
      </div>

      <ul className="mb-2" hidden={queue.length === 0}>
        {queue.map((vid) => (
          <li key={vid.queueId} className="truncate text-gray-700">
            <span className="select-none">• </span>
            {vid.query ? (
              <span className="text-gray-400 text-sm">{vid.query}</span>
            ) : (
              <a
                href={vid.url}
                className="hover:text-blue-500 hover:underline text-sm"
                title={vid.title}
              >
                {vid.title}
              </a>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-row rounded bg-gray-100 border-0">
        {isElectron() ? (
          <input
            className="py-1 px-2 flex-1 block text-sm bg-transparent border-0 ring-0 focus:border-0 focus:ring-0"
            placeholder="Search & queue music"
            type="text"
            onKeyUp={handleSearchInput}
          />
        ) : (
          <div className="py-1 px-2 flex-1 block text-sm">
            Music queueing is available only on the desktop Flocc app.
          </div>
        )}
      </div>
    </div>
  );
}
