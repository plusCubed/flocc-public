const main = async () => {
  const ytsr = require('ytsr');

  const filters1 = await ytsr.getFilters('lofi');
  const filter1 = filters1.get('Type').get('Video');
  const options = {
    limit: 1,
  };
  const searchResults = await ytsr(filter1.url, options);
  console.log(searchResults.items);
};

main();
