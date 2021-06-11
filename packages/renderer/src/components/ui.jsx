import React, { useEffect, useState } from 'react';

export function Select({ children, className, ...rest }) {
  return (
    <select
      className={
        'block w-full rounded-md border-gray-300 pl-2 pr-7 py-1 bg-white text-sm leading-5 text-gray-800 hover:text-gray-700 focus:outline-none focus:ring-teal-300 focus:ring-2 active:bg-gray-100 active:text-gray-800 cursor-pointer transition ease-in-out duration-150 ' +
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
      className={`bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1 px-2 rounded disabled:opacity-75 focus:outline-none ${
        className || ''
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children, className, ...rest }) {
  return (
    <div
      className={`uppercase tracking-widest text-xs ${className || ''}`}
      {...rest}
    >
      <span>{children}</span>
    </div>
  );
}
