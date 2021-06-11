import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import isElectron from 'is-electron';
import ReactPlayer from 'react-player/youtube';
import { useDatabase } from 'reactfire';

import { usePrevious } from '../hooks/usePrevious';

import { MusicIcon, SkipNextIcon } from './icons';
import { Button } from './ui';
import {
  useDatabaseListData,
  useDatabaseObjectData,
} from '../hooks/useDatabase';
import { electronApi } from '../util/electronApi';

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
  const musicDbRef = database.ref(`rooms/${currentRoomId}/music`);
  const musicSyncDbRef = database.ref(`musicSync/${currentRoomId}`);
  const handleSearchInput = useCallback(
    async (e) => {
      const query = e.target.value;
      // ENTER
      if (e.keyCode === 13 && query) {
        e.target.value = '';

        const queueId = Math.floor(Date.now() / 1000);
        await musicDbRef.child(`${queueId}`).set({ query });

        const reset = async () => {
          await musicDbRef.child(`${queueId}`).remove();
          await musicSyncDbRef.child(`${queueId}`).remove();
        };

        const options = { limit: 1 };
        electronApi().send('ytsr', query, options);
        electronApi().once(
          'ytsr-response',
          async (event, error, searchResults) => {
            if (!error) {
              if (searchResults.items && searchResults.items[0]) {
                const result = searchResults.items[0];
                await musicDbRef.child(`${queueId}`).set({
                  title: result.title,
                  url: result.url,
                  duration: result.duration,
                  isLive: result.isLive,
                });
                await musicSyncDbRef.child(`${queueId}`).set({
                  playedSeconds: 0,
                  playing: true,
                });
              } else {
                // TODO: display no search results
                reset();
              }
            } else {
              console.error('Search error');
              reset();
            }
          }
        );
      }
    },
    [musicDbRef, musicSyncDbRef]
  );

  const [volume, setVolume] = useState(0);
  useEffect(() => {
    const initialVolume = localStorage.getItem('musicVolume') || 50;
    setVolume(parseInt(initialVolume));
  }, []);
  useEffect(() => {
    localStorage.setItem('musicVolume', volume.toString());
  }, [volume]);
  const handleVolumeInput = useCallback((e) => {
    setVolume(parseInt(e.currentTarget.value));
  }, []);

  const [url, setUrl] = useState('');

  const musicQueue = useDatabaseListData(musicDbRef.orderByKey(), {
    idField: 'queueId',
  });

  const playing =
    useDatabaseObjectData(
      musicSyncDbRef
        .child(`${musicQueue?.[0]?.queueId}` || 'invalid')
        .child('playing')
    ) === true;

  const prevQueue = usePrevious(musicQueue);
  useEffect(() => {
    if (
      prevQueue?.[0]?.queueId !== musicQueue?.[0]?.queueId ||
      prevQueue?.[0]?.url !== musicQueue?.[0]?.url
    ) {
      if (musicQueue?.[0]?.url) {
        if (prevQueue?.[0]?.url === musicQueue?.[0]?.url) {
          setUrl(''); // clear player
        }

        setUrl(`${musicQueue[0].url}`);
      } else {
        setUrl(null);
      }
    }
  }, [currentRoomId, database, prevQueue, musicQueue]);

  const handleNext = useCallback(() => {
    if (musicQueue.length > 0) {
      const currentQueueId = musicQueue[0].queueId;
      musicDbRef.child(currentQueueId.toString()).remove();
      musicSyncDbRef.child(currentQueueId.toString()).remove();
    }
  }, [musicDbRef, musicSyncDbRef, musicQueue]);

  const handlePlayerProgress = useCallback(
    ({ played, playedSeconds, loaded, loadedSeconds }) => {
      if (!musicQueue?.[0]?.isLive) {
        musicSyncDbRef
          .child(`${musicQueue[0].queueId}/playedSeconds`)
          .set(playedSeconds);
      }
    },
    [musicSyncDbRef, musicQueue]
  );

  const handlePause = useCallback(() => {
    console.log('pause');
    musicSyncDbRef.child(`${musicQueue[0].queueId}/playing`).set(false);
  }, [musicSyncDbRef, musicQueue]);

  const handlePlay = useCallback(() => {
    console.log('play');
    musicSyncDbRef.child(`${musicQueue[0].queueId}/playing`).set(true);
  }, [musicSyncDbRef, musicQueue]);

  const handlePlayerReady = useCallback(() => {
    console.log('ready');
    if (!musicQueue?.[0]?.isLive) {
      // Seek to playedSeconds (if it exists)
      (async () => {
        const playedSeconds = (
          await musicSyncDbRef
            .child(`${musicQueue[0].queueId}`)
            .child('playedSeconds')
            .once('value')
        ).val();
        playerRef.current?.seekTo(playedSeconds, 'seconds');
      })();
    }
  }, [musicSyncDbRef, musicQueue]);

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
            defaultValue={volume.toString()}
            onInput={handleVolumeInput}
          />

          <div className="flex-1" />

          <Button className="text-sm" onClick={handleNext}>
            <SkipNextIcon width={18} height={18} />
          </Button>
        </div>
      </div>

      <ul className="mb-2" hidden={musicQueue.length === 0}>
        {musicQueue.map((vid) => (
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
