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

export function MatMicrophoneOffIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      {...props}
      stroke="currentColor"
    >
      <path d="M15 10.6V5c0-1.66-1.34-3-3-3-1.54 0-2.79 1.16-2.96 2.65L15 10.6zm3.08.4c-.41 0-.77.3-.83.71-.05.32-.12.64-.22.93l1.27 1.27c.3-.6.52-1.25.63-1.94.07-.51-.33-.97-.85-.97zM3.71 3.56c-.39.39-.39 1.02 0 1.41L9 10.27v.43c0 1.19.6 2.32 1.63 2.91.75.43 1.41.44 2.02.31l1.66 1.66c-.71.33-1.5.52-2.31.52-2.54 0-4.88-1.77-5.25-4.39-.06-.41-.42-.71-.83-.71-.52 0-.92.46-.85.97.46 2.96 2.96 5.3 5.93 5.75V20c0 .55.45 1 1 1s1-.45 1-1v-2.28c.91-.13 1.77-.45 2.55-.9l3.49 3.49c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.12 3.56c-.39-.39-1.02-.39-1.41 0z" />
    </svg>
  );
}

export function MatMicrophoneIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      {...props}
      stroke="currentColor"
    >
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
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

export function ExitIcon(props) {
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
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function AddIcon(props) {
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
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
  );
}

export function SettingsIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 20 20"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Select({ children, className, ...rest }) {
  return (
    <select
      className={
        'inline-flex justify-center w-full rounded-md border border-gray-300 px-2 py-1 bg-white text-sm leading-5 font-medium text-gray-800 hover:text-gray-700 focus:outline-none focus:ring-teal-300 focus:ring-2 active:bg-gray-100 active:text-gray-800 cursor-pointer transition ease-in-out duration-150 ' +
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

export function Button({ children, className, ...rest }) {
  return (
    <button
      className={`bg-teal-600 hover:bg-teal-700 text-white font-medium py-1 px-2 rounded disabled:opacity-75 focus:outline-none ${
        className || ''
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
