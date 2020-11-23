const main = async () => {
  const ytsr = require('ytsr');
  const res = await ytsr('logic', { limit: 1 });
  console.log(res);
};

main();
