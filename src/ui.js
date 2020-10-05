import React, { useEffect, useState } from 'react';

export function MicrophoneIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

export function SpeakerIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

export function Select({ children, className, ...rest }) {
  return (
    <select
      className={
        'inline-flex justify-center w-full rounded-md border border-gray-300 px-2 py-1 bg-white text-sm leading-5 font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800 transition ease-in-out duration-150 ' +
        className
      }
      {...rest}
    >
      {children}
    </select>
  );
}

export function Option({ children, className, ...rest }) {
  return (
    <option
      className={
        'px-4 py-2 text-sm leading-5 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900' +
        className
      }
      {...rest}
    >
      {children}
    </option>
  );
}

export function Audio({ srcObject, sinkId, ...rest }) {
  const [audioEl, setAudioEl] = useState(null);
  useEffect(() => {
    if (audioEl) {
      audioEl.srcObject = srcObject;
    }
  }, [audioEl, srcObject]);
  useEffect(() => {
    if (!audioEl || !sinkId) return;
    if (typeof audioEl.sinkId === 'undefined') {
      console.warn('Browser does not support output device selection');
    }
    audioEl
      .setSinkId(sinkId)
      .then(() => {
        console.log(`Success, audio output device attached: ${sinkId}`);
      })
      .catch((error) => {
        let errorMessage = error;
        if (error.name === 'SecurityError') {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
        }
        console.error(errorMessage);
        // TODO: Jump back to first output device in the list as it's the default.
      });
  }, [audioEl, sinkId, srcObject]);

  return <audio ref={(el) => setAudioEl(el)} {...rest} />;
}

export function Button({ children, ...rest }) {
  return (
    <button
      className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded disabled:opacity-75"
      {...rest}
    >
      {children}
    </button>
  );
}
