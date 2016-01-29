'use strict';

var got = require('got');
var xml2js = require('xml2js').parseString;
var objectAssign = require('object-assign');
var util = require('util');
var trim = require('trim');

var preferredStreams = [
  {quality: 'highestpls', format: 'aac'},
  {quality: 'highestpls', format: 'mp3'},
  {quality: 'fastpls', format: 'mp3'},
  {quality: 'fastpls', format: 'aacp'},
  {quality: 'slowpls', format: 'aacp'},
  {quality: 'slowpls', format: 'mp3'}
];

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

  got('http://somafm.com/channels.xml', function (err, data) {
    parseXml(err, data, options);
  });

  function parseXml(err, data, options) {
    if (err) {
      return cb(err);
    }

    xml2js(data, function (err, res) {
      parseData(err, res, options);
    });
  }

  function parseData(err, res, options) {
    if (err) {
      return cb(err);
    }

    var jsonData = options.sortChannels ?
      res.channels.channel.sort(compareChannelObjects) :
      res.channels.channel;
    var channels = [];

    if (options.raw) {
      return cb(null, jsonData);
    }

    jsonData.forEach(function (channel) {
      var streamHighestQuality = {};

      streamHighestQuality = getHighestQualityStream(channel);

      var channelObj = {
        id: channel.$.id,
        title: channel.title[0],
        fullTitle: 'SomaFM ' + channel.title[0],
        description: trim(channel.description[0]),
        dj: channel.dj[0],
        genre: channel.genre[0],
        lastPlaying: channel.lastPlaying[0],
        listeners: channel.listeners[0],
        stream: streamHighestQuality
      };
      channels.push(channelObj);
    });

    return cb(null, channels);
  }

  function compareChannelObjects(a, b) {
    return a.title[0].toLowerCase().localeCompare(b.title[0].toLowerCase());
  }

  function getHighestQualityStream(channel) {
    for (var i = 0; i < options.streams.length; i++) {
      var stream = options.streams[i];

      if (channel[stream.quality]) {
        for (var j = 0; j < channel[stream.quality].length; j++) {
          var format = channel[stream.quality][j];

          if (format.$.format === stream.format) {
            var res = {
              url: format._,
              format: format.$.format,
              quality: stream.quality
            };

            return res;
          }
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

somafm.dump = function (obj) {
  console.log(util.inspect(obj, {showHidden: false, depth: null}));
};
