'use strict';
const got = require('got');
const trim = require('trim');
const CacheConf = require('cache-conf');
const pkg = require('./package.json');

const PREFERRED_STREAMS = [
  {quality: 'highest', format: 'aac'},
  {quality: 'highest', format: 'mp3'},
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
let channels;

function getChannels(options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  options = Object.assign({}, options);
  options.streams = Object.assign(PREFERRED_STREAMS, options.streams);

  channels = readChannels();

  if (channels.length === 0 || options.forceUpdate) {
    got('https://api.somafm.com/channels.json', GOT_OPTS)
      .then(res => {
        parseData(res.body, options, (err, res) => {
          if (err) {
            cb(err);
            return;
          }

          writeChannels(res);

          cb(null, res);
        });
      })
      .catch(err => {
        cb(err);
      });
  } else {
    cb(null, channels);
  }
}

function parseData(res, options, cb) {
  res = JSON.parse(res);

  const data = options.sortChannels ?
    res.channels.sort(compareChannelObjects) :
    res.channels;
  let channels = [];

  if (options.raw) {
    return cb(null, data);
  }

  data.forEach(channel => {
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

  if (options.search && options.search.length > 0) {
    channels = filterChannels(channels, options.search);
  }

  return cb(null, channels);
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

function filterChannels(channels, keywords) {
  const regexes = [];
  for (let i = 0; i < keywords.length; i++) {
    regexes.push(new RegExp(keywords[i]));
  }

  return channels.filter(channel => {
    for (let i = 0; i < regexes.length; i++) {
      if (!channel.title.match(regexes[i]) && !channel.description.match(regexes[i]) && !channel.genre.match(regexes[i]) && !channel.dj.match(regexes[i])) {
        return false;
      }
    }

    return true;
  });
}

function getChannel(id, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  options = Object.assign({sortChannels: true}, options);

  getChannels(options, (err, res) => {
    if (err) {
      return cb(err, null);
    }

    for (const key in res) {
      if (id.toLowerCase() === res[key].id) {
        return cb(null, res[key]);
      }
    }

    return cb(new Error('Channel not found.'), null);
  });
}

function readChannels() {
  return channelsConf.get('channels') || [];
}

function writeChannels(channels) {
  // cache channels for one minute
  channelsConf.set('channels', channels, {maxAge: 60000});
}

somafm.getChannels = getChannels;
somafm.getChannel = getChannel;

module.exports = somafm;
