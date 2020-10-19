const ytdl = require('ytdl-core');

/**
 * Tries to find the highest bitrate audio-only format. Failing that, will use any available audio format.
 * @private
 * @param {Object[]} formats The formats to select from
 * @param {boolean} isLive Whether the content is live or not
 */
function nextBestFormat(formats, isLive) {
  let filter = (format) => format.audioBitrate;
  if (isLive) {
    filter = (format) => format.audioBitrate && format.isHLS;
  }
  formats = formats.filter(filter).sort((a, b) => {
    if (!b.hasVideo && a.hasVideo) {
      return 1;
    } else if (!a.hasVideo && b.hasVideo) {
      return -1;
    }
    return b.audioBitrate - a.audioBitrate;
  });
  return formats.find((format) => !format.bitrate) || formats[0];
}

async function download(url, options = {}) {
  const info = await ytdl.getInfo(url);
  const bestFormat = nextBestFormat(
    info.formats,
    info.player_response.videoDetails.isLiveContent
  );
  if (!bestFormat) throw new Error('No suitable format found');
  return bestFormat.url;
}

module.exports = Object.assign(download, ytdl);
