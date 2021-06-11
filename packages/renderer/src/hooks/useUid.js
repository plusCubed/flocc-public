import { useUser } from 'reactfire';

export const useUid = () => {
  return useUser().data.uid;
};
