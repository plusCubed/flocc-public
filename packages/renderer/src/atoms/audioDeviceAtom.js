import { atom } from 'recoil';

const localStorageEffect =
  (key) =>
  ({ setSelf, onSet }) => {
    const savedValue = localStorage.getItem(key);
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue));
    }

    onSet((newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue));
    });
  };

export const audioInputAtom = atom({
  key: 'audioInput',
  default: '',
  effects_UNSTABLE: [localStorageEffect('audio_input')],
});

export const audioOutputAtom = atom({
  key: 'audioOutput',
  default: '',
  effects_UNSTABLE: [localStorageEffect('audio_output')],
});
