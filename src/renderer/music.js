import React, { useEffect, useState, useMemo } from 'react';
import ReactPlayer from 'react-player';

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

  return (
    <div className="py-2 pr-1">
      <ReactPlayer
        playing
        height={100}
        width="100%"
        url="https://www.youtube.com/watch?v=ysz5S6PUM-U"
        config={config}
      />
    </div>
  );
}
