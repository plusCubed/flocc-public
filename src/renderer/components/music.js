import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactPlayer from 'react-player/youtube';

export function Music() {
  /*const [url, setUrl] = useState('');
  useEffect(() => {
    ipcRenderer.once('yt-res', (event, arg) => {
      console.log('received', arg);
      setUrl(arg);
    });
    ipcRenderer.send('yt-req', 'DWcJFNfaw9c');
  });*/

  const config = useMemo(() => {
    return {
      youtube: {},
    };
  }, []);

  const playerRef = useRef(null);

  return (
    <div className="py-2 pr-1 border-t border-solid border-gray-200">
      <input placeholder="Search music" />
      <ReactPlayer
        height={100}
        width="100%"
        url="https://www.youtube.com/watch?v=ysz5S6PUM-U"
        config={config}
        ref={playerRef}
      />
    </div>
  );
}
