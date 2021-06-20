import React, { Fragment } from 'react';

import { Dialog, Transition } from '@headlessui/react';

import { CloseIcon } from './icons';

export function Toast({ dismiss, text }) {
  return (
    <Transition
      appear
      show={true}
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      as={Fragment}
    >
      <Dialog
        className="fixed bottom-10 bg-gray-50 rounded shadow-md m-4 pl-4 pr-3 py-3 flex"
        onClose={() => dismiss()}
      >
        <div className="whitespace-pre">{text}</div>
        <div className="flex-1 w-5" />
        <button
          className="focus:outline-none text-gray-400 hover:text-gray-600 active:text-gray-800"
          onClick={() => dismiss()}
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </Dialog>
    </Transition>
  );
}
