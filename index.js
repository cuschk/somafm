'use strict';
var got = require('got');
var objectAssign = require('object-assign');
var trim = require('trim');
var pkg = require('./package.json');

var preferredStreams = [
  {quality: 'highest', format: 'aac'},
  {quality: 'highest', format: 'mp3'},
  {quality: 'high', format: 'mp3'},
  {quality: 'high', format: 'aacp'},
  {quality: 'low', format: 'aacp'},
  {quality: 'low', format: 'mp3'}
];

var gotOpts = {
  headers: {
    'user-agent': `somafm/${pkg.version} (https://github.com/uschek/somafm)`
  }
};

var somafm = module.exports;

somafm.getChannels = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  options = objectAssign({}, options);

  options.streams = objectAssign(preferredStreams, options.streams);

  got('https://api.somafm.com/channels.json', gotOpts, function (err, data) {
    parse(err, data, options, cb);
  });

  function parse(err, res, options, cb) {
    if (err) {
      return cb(err);
    }

    res = JSON.parse(res);

    var data = options.sortChannels ?
      res.channels.sort(compareChannelObjects) :
      res.channels;
    var channels = [];

    if (options.raw) {
      return cb(null, data);
    }

    data.forEach(function (channel) {
      var streamHighestQuality = getHighestQualityStream(channel);

      var channelObj = {
        id: channel.id,
        title: channel.title,
        fullTitle: 'SomaFM ' + channel.title,
        description: trim(channel.description),
        dj: channel.dj,
        genre: channel.genre.replace(/\|/g, '/'),
        lastPlaying: channel.lastPlaying,
        listeners: channel.listeners,
        stream: streamHighestQuality
      };
      channels.push(channelObj);
    });

    return cb(null, channels);
  }

  function compareChannelObjects(a, b) {
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  }

  function getHighestQualityStream(channel) {
    for (var i = 0; i < options.streams.length; i++) {
      var stream = options.streams[i];

      for (var j = 0; j < channel.playlists.length; j++) {
        if (channel.playlists[j].quality === stream.quality && channel.playlists[j].format === stream.format) {
          var res = {
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
};

somafm.getChannel = function (id, cb) {
  somafm.getChannels({sortChannels: true},
    function (err, res) {
      if (err) {
        return cb(err, null);
      }

      for (var key in res) {
        if (id.toLowerCase() === res[key].id) {
          return cb(null, res[key]);
        }
      }

      return cb(new Error('Channel not found.'), null);
    }
  );
};
