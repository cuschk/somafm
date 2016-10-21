'use strict';
const got = require('got');
const trim = require('trim');
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

const somafm = {};

somafm.getChannels = (options, cb) => {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  options = Object.assign({}, options);

  options.streams = Object.assign(PREFERRED_STREAMS, options.streams);

  got('https://api.somafm.com/channels.json', GOT_OPTS)
    .then(res => {
      parse(res.body, options, cb);
    })
    .catch(err => {
      cb(err);
    });

  function parse(res, options, cb) {
    res = JSON.parse(res);

    const data = options.sortChannels ?
      res.channels.sort(compareChannelObjects) :
      res.channels;
    let channels = [];

    if (options.raw) {
      return cb(null, data);
    }

    data.forEach(channel => {
      const streamHighestQuality = getHighestQualityStream(channel);

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

  function getHighestQualityStream(channel) {
    for (let i = 0; i < options.streams.length; i++) {
      const stream = options.streams[i];

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
};

somafm.getChannel = (id, cb) => {
  somafm.getChannels({sortChannels: true}, (err, res) => {
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
};

module.exports = somafm;
