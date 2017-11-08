'use strict';
const fs = require('fs');
const path = require('path');
const got = require('got');
const tempDir = require('temp-dir');
const makeDir = require('make-dir');
const ini = require('ini');
const trim = require('trim');
const CacheConf = require('cache-conf');
const pkg = require('./package.json');

const PREFERRED_STREAMS = [
  {quality: 'highest', format: 'mp3'},
  {quality: 'highest', format: 'aac'},
  {quality: 'high', format: 'mp3'},
  {quality: 'high', format: 'aacp'},
  {quality: 'low', format: 'aacp'},
  {quality: 'low', format: 'mp3'}
];

const GOT_OPTS = {headers: {'user-agent': `somafm/${pkg.version} (https://github.com/uschek/somafm)`}};

const configName = (process.env.NODE_ENV === 'test' ? 'channels-test' : 'channels');
const channelsConf = new CacheConf({projectName: pkg.name, configName});

const somafm = {};
let channels = [];

function getChannels(options) {
  options = Object.assign({}, options);
  options.streams = Object.assign(PREFERRED_STREAMS, options.streams);

  return getChannelsFromAPIOrCache(options)
    .then(channels => filterChannels(channels, options.search));
}

function getChannelsFromAPIOrCache(options) {
  if (channels.length === 0) {
    channels = getCachedChannels();
  }

  if (channels.length === 0 || options.forceUpdate) {
    return getChannelsFromAPI(options)
      .then(setCachedChannels);
  }

  return Promise.resolve(channels);
}

function getChannelsFromAPI(options) {
  return got('https://api.somafm.com/channels.json', GOT_OPTS)
    .then(res => parseJSONData(res.body, options));
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
      dj: channel.dj,
      genre: channel.genre.replace(/\|/g, '/'),
      lastPlaying: channel.lastPlaying,
      listeners: channel.listeners,
      stream: streamHighestQuality,
      image: channel.image
    });
  }

  if (options.sortChannels) {
    channels.sort(compareChannelObjects);
  }

  return Promise.resolve(channels);
}

function compareChannelObjects(a, b) {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
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
      resolve(applyFilter(channels, [search]));
    } else {
      resolve(channels);
    }
  });
}

function applyFilter(channels, search) {
  return channels.filter(channel => {
    for (let i = 0; i < search.length; i++) {
      if (!isSubstringOfAny(String(search[i]).toLowerCase(), [
        channel.id,
        channel.title,
        channel.description,
        channel.genre,
        channel.dj
      ])) {
        return false;
      }
    }

    return true;
  });
}

function isSubstringOf(search, str) {
  return str.toLowerCase().indexOf(search) > -1;
}

function isSubstringOfAny(search, arr) {
  for (let i = 0; i < arr.length; i++) {
    if (isSubstringOf(search, arr[i])) {
      return true;
    }
  }

  return false;
}

function getChannel(id, options) {
  options = Object.assign({sortChannels: true}, options);

  return getChannels(options)
    .then(channels => getChannelById(id, channels))
    .then(channel => {
      return getStreamUrls(channel)
        .then(urls => {
          channel.stream.urls = urls;
          setCachedChannels(channels);

          return Promise.resolve(channel);
        })
        .catch(console.log);
    })
    .then(channel => {
      const imageDir = path.join(tempDir, pkg.name);
      channel.imageFile = path.join(imageDir, channel.id);

      if (!fs.existsSync(channel.imageFile)) {
        makeDir.sync(imageDir);
        got.stream(channel.image).pipe(fs.createWriteStream(channel.imageFile));
      }

      return Promise.resolve(channel);
    });
}

function getChannelById(id, channels) {
  return new Promise((resolve, reject) => {
    for (const channel of channels) {
      if (id.toLowerCase() === channel.id) {
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
  return new Promise((resolve, reject) => {
    got(playlistUrl)
      .then(response => {
        const data = ini.decode(response.body);
        const res = [];

        Object.keys(data.playlist)
          .filter(x => x.match(/^File[0-9]+$/))
          .forEach(key => {
            res.push(data.playlist[key]);
          });

        resolve(res);
      })
      .catch(reject);
  });
}

function getCachedChannels() {
  return channelsConf.get('channels') || [];
}

function setCachedChannels(data) {
  channels = data;

  // Cache channels for one minute
  channelsConf.set('channels', data, {maxAge: 60000});

  return Promise.resolve(data);
}

somafm.getChannels = getChannels;
somafm.getChannel = getChannel;

module.exports = somafm;
