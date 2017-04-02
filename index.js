'use strict';
const got = require('got');
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

const GOT_OPTS = {
  headers: {
    'user-agent': `somafm/${pkg.version} (https://github.com/uschek/somafm)`
  }
};

const channelsConf = new CacheConf({projectName: pkg.name, configName: 'channels'});

const somafm = {};
let channels = [];

function getChannels(options) {
  options = Object.assign({}, options);
  options.streams = Object.assign(PREFERRED_STREAMS, options.streams);

  return new Promise((resolve, reject) => {
    getChannelsFromAPIOrCache(options)
      .then(channels => {
        resolve(filterChannels(channels, options.search));
      })
      .catch(err => {
        reject(err);
      });
  });
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
    .then(res => {
      return parseJSONData(res.body, options);
    });
}

function parseJSONData(json, options) {
  json = JSON.parse(json);

  const channelsRaw = options.sortChannels ?
    json.channels.sort(compareChannelObjects) :
    json.channels;
  const channels = [];

  channelsRaw.forEach(channel => {
    const streamHighestQuality = getHighestQualityStream(channel, options.streams);

    const channelObj = {
      id: channel.id,
      title: channel.title,
      fullTitle: `SomaFM ${channel.title}`,
      description: trim(channel.description),
      dj: channel.dj,
      genre: channel.genre.replace(/\|/g, '/'),
      lastPlaying: channel.lastPlaying,
      listeners: channel.listeners,
      stream: streamHighestQuality
    };
    channels.push(channelObj);
  });

  return Promise.resolve(channels);
}

function compareChannelObjects(a, b) {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

function getHighestQualityStream(channel, streams) {
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];

    for (let j = 0; j < channel.playlists.length; j++) {
      if (channel.playlists[j].quality === stream.quality && channel.playlists[j].format === stream.format) {
        const res = {
          url: channel.playlists[j].url,
          format: channel.playlists[j].format,
          quality: channel.playlists[j].quality
        };

        return res;
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
  const regexes = [];
  for (let i = 0; i < search.length; i++) {
    regexes.push(new RegExp(search[i], 'i'));
  }

  return channels.filter(channel => {
    for (let i = 0; i < regexes.length; i++) {
      if (!channel.id.match(regexes[i]) && !channel.title.match(regexes[i]) && !channel.description.match(regexes[i]) && !channel.genre.match(regexes[i]) && !channel.dj.match(regexes[i])) {
        return false;
      }
    }

    return true;
  });
}

function getChannel(id, options) {
  options = Object.assign({sortChannels: true}, options);

  return new Promise((resolve, reject) => {
    getChannels(options).then(channels => {
      for (let i = 0; i < channels.length; i++) {
        if (id.toLowerCase() === channels[i].id) {
          resolve(channels[i]);
        }
      }

      reject(new Error('Channel not found.'));
    }).catch(err => {
      reject(err);
    });
  });
}

function getCachedChannels() {
  return channelsConf.get('channels') || [];
}

function setCachedChannels(channels) {
  // cache channels for one minute
  channelsConf.set('channels', channels, {maxAge: 60000});

  return Promise.resolve(channels);
}

somafm.getChannels = getChannels;
somafm.getChannel = getChannel;

module.exports = somafm;
