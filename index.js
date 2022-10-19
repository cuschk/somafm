'use strict';
const fs = require('fs');
const path = require('path');
const got = require('got');
const tempDir = require('temp-dir');
const makeDir = require('make-dir');
const ini = require('ini');
const trim = require('trim');
const CacheConf = require('cache-conf');
const utils = require('./utils.js');
const pkg = require('./package.json');

const PREFERRED_STREAMS = [
  {quality: 'highest', format: 'mp3'},
  {quality: 'highest', format: 'aac'},
  {quality: 'high', format: 'mp3'},
  {quality: 'high', format: 'aacp'},
  {quality: 'low', format: 'aacp'},
  {quality: 'low', format: 'mp3'}
];

const GOT_OPTS = {headers: {'user-agent': `somafm/${pkg.version}`}};

const configName = (process.env.NODE_ENV === 'test' ? 'channels-test' : 'channels');
const channelsConf = new CacheConf({projectName: pkg.name, configName});

let channels = [];

async function getChannels(options) {
  options = {...options};
  options.streams = Object.assign(PREFERRED_STREAMS, options.streams);

  const randomChannel = {
    id: 'random',
    title: 'Random',
    description: 'Roll a dice and listen to any SomaFM channel. Best choice if you like being surprised.',
    dj: 'Randomizer',
    genre: 'random'
  };

  const channels = await getChannelsFromAPIOrCache(options);

  return filterChannels([randomChannel, ...channels], options.search);
}

async function getChannelsFromAPIOrCache(options) {
  if (channels.length === 0) {
    channels = getCachedChannels();
  }

  if (channels.length === 0 || options.forceUpdate) {
    return setCachedChannels(await getChannelsFromAPI(options));
  }

  return channels;
}

async function getChannelsFromAPI(options) {
  const response = await got('https://api.somafm.com/channels.json', GOT_OPTS);

  return parseJSONData(response.body, options);
}

function parseJSONData(json, options) {
  const data = JSON.parse(json).channels;
  const channels = [];

  for (const channel of data) {
    const streamHighestQuality = getHighestQualityStream(channel, options.streams);

    channels.push({
      id: channel.id,
      title: channel.title,
      fullTitle: channel.title.startsWith('SomaFM') ? channel.title : `SomaFM ${channel.title}`,
      description: trim(channel.description),
      web: `https://somafm.com/${channel.id}/`,
      dj: channel.dj,
      genre: channel.genre.replace(/\|/g, '/'),
      lastPlaying: channel.lastPlaying,
      listeners: Number(channel.listeners),
      stream: streamHighestQuality,
      image: channel.image
    });
  }

  if (options.sortChannels) {
    channels.sort(compareChannelObjects);
  }

  return Promise.resolve(channels);
}

function compareChannelObjects(ch1, ch2) {
  return Math.sign(ch2.listeners - ch1.listeners);
}

function getHighestQualityStream(channel, streams) {
  for (const stream of streams) {
    for (const playlist of channel.playlists) {
      if (playlist.quality === stream.quality && playlist.format === stream.format) {
        return {
          url: playlist.url,
          format: playlist.format,
          quality: playlist.quality
        };
      }
    }
  }

  return null;
}

function filterChannels(channels, search) {
  return new Promise(resolve => {
    if (Array.isArray(search) && search.length > 0) {
      resolve(applyFilter(channels, search));
    } else if (typeof search === 'string') {
      resolve(applyFilter(channels, search.split(' ')));
    } else {
      resolve(channels);
    }
  });
}

function applyFilter(channels, search) {
  return channels.filter(channel => utils.searchArrayMatchesAny(
    search, [channel.id, channel.title, channel.description, channel.genre, channel.dj]
  ));
}

async function getChannel(id, options) {
  options = {sortChannels: true, ...options};

  const channels = await getChannels(options);
  const channel = await getChannelById(id, channels);
  const urls = await getStreamUrls(channel);

  channel.stream.urls = urls;

  await setCachedChannels(channels.filter(channel => channel.id !== 'random'));

  const imageDir = path.join(tempDir, pkg.name);
  channel.imageFile = path.join(imageDir, channel.id);

  if (!fs.existsSync(channel.imageFile)) {
    makeDir.sync(imageDir);
    got.stream(channel.image).pipe(fs.createWriteStream(channel.imageFile));
  }

  return channel;
}

function getChannelById(id, channels) {
  return new Promise((resolve, reject) => {
    if (utils.fuzzyMatch(id, 'random')) {
      resolve(channels[
        Math.floor(channels.length * Math.random())
      ]);
    }

    for (const channel of channels) {
      if (utils.fuzzyMatch(id, channel.id)) {
        resolve(channel);
      }
    }

    reject(new Error('Channel not found.'));
  });
}

function getStreamUrls(channel) {
  if (channel.stream.urls) {
    return Promise.resolve(channel.stream.urls);
  }

  return getUrlsFromPlaylist(channel.stream.url);
}

function getUrlsFromPlaylist(playlistUrl) {
  return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
    const response = await got(playlistUrl);

    try {
      const data = ini.decode(response.body);
      const result = [];

      for (const key of Object.keys(data.playlist)
        .filter(x => x.match(/^File\d+$/))) {
        result.push(data.playlist[key]);
      }

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

function getCachedChannels() {
  return channelsConf.get('channels') || [];
}

function setCachedChannels(data) {
  return new Promise(resolve => {
    channels = data;

    // Cache channels for one minute
    channelsConf.set('channels', data, {maxAge: 60_000});

    resolve(data);
  });
}

module.exports = {
  getChannels,
  getChannel,
  filterChannels
};
