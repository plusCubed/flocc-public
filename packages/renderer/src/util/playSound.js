export const playSound = async (sound, outputDevice) => {
  const audioEl = new Audio(sound);
  audioEl.volume = 0.3;
  if (outputDevice) await audioEl.setSinkId(outputDevice);
  await audioEl.play();
};
