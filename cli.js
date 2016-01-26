#!/usr/bin/env node

'use strict';

var pkg = require('./package.json');
var somafm = require('./');
var chalk = require('chalk');
var minimist = require('minimist');
var childProcess = require('child_process');
var isBin = require('isbin');
var dateFormat = require('dateformat');
var trim = require('trim');

var options = minimist(process.argv.slice(2));
var args = options._;

delete options._;

var mplayerBin = 'mplayer';
var streamripperBin = 'streamripper';

function showHelp() {
  console.log(
  `
  ${pkg.description}

  Usage
    somafm <command> [<channel>]

  Commands
    list                list channels
    get <channel>       show channel information
    play <channel>      play channel
    record <channel>    start recording channel

  Examples
    somafm list
    somafm get groovesalad
    somafm play fluid`
  );
}

function showChannelList(channels) {
  console.log();

  channels.forEach(function (channel) {
    console.log(
      `${chalk.bold(channel.title)} [${chalk.green(channel.id)}] ${chalk.blue(channel.description)}`
    );
  });
}

function showChannel(channel) {
  console.log(
  `
  ${chalk.bold(channel.fullTitle)} [${chalk.green(channel.id)}]

  ${chalk.blue(channel.description)}

       ${chalk.yellow('Now playing')}   ${channel.lastPlaying}

                ${chalk.yellow('DJ')}   ${channel.dj}
             ${chalk.yellow('Genre')}   ${channel.genre}
         ${chalk.yellow('Listeners')}   ${channel.listeners}

        ${chalk.yellow('Stream URL')}   ${channel.stream.url}
    ${chalk.yellow('Stream quality')}   ${channel.stream.quality} ${channel.stream.format}`
  );
}

function list() {
  somafm.getChannels({sortChannels: true},
    function (err, res) {
      if (err) {
        console.error(err.toString());
        process.exit(20);
      }

      showChannelList(res);
    }
  );
}

function get() {
  somafm.getChannel(args[1], function (err, channel) {
    if (err) {
      console.error(err.toString());
      process.exit(10);
    }

    showChannel(channel);
  });
}

function play(channel, cb) {
  if (!isBin(mplayerBin)) {
    cb(new Error('MPlayer executable not found. Please ensure MPlayer is installed on your system and runnable with the "mplayer" command.'));
    return;
  }

  console.log(`\n  Playing ${chalk.bold(channel.fullTitle)} ...\n`);

  var args = [
    '-quiet',
    '-playlist',
    channel.stream.url
  ];
  var mplayerProc = childProcess.spawn(mplayerBin, args);

  mplayerProc.stdout.on('data', function (data) {
    var line = data.toString();

    var regex = /StreamTitle='(.*)';StreamUrl=/;
    var res = line.match(regex);

    if (res && res[1]) {
      var time = dateFormat(new Date(), 'HH:MM:ss');
      console.log(`  ${chalk.yellow(time)}  ${res[1]}`);
    }
  });

  mplayerProc.on('error', function (err) {
    cb(err);
    return;
  });

  mplayerProc.on('exit', function () {
    console.log('\nMPlayer exited.');
    cb(null);
    return;
  });
}

function record(channel, cb) {
  if (!isBin(streamripperBin)) {
    cb(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
    return;
  }

  var date = dateFormat(new Date(), 'yyyymmdd_HHMMss');
  var args = [
    channel.stream.url,
    '-D', `${channel.fullTitle}/${date}/%1q %A - %T`
  ];
  var streamripperProc = childProcess.spawn(streamripperBin, args);
  var currentStatus;
  var currentSong;

  console.log(`
  Recording ${chalk.bold(channel.fullTitle)}
  to directory ${chalk.yellow(`${channel.fullTitle}/${date}`)} ...\n`
  );

  streamripperProc.stdout.on('data', function (data) {
    var line = data.toString();

    var regex = /^\[(r|sk)ipping.*\] (.*) \[(.{7})\]$/m;
    var res = line.match(regex);

    if (res && res[1] && res[2]) {
      if ((currentStatus !== res[1] || currentSong !== res[2]) && res[2].length > 1) {
        if (res[3] && trim(res[3]) === '0b') {
          return;
        }

        currentStatus = res[1];
        currentSong = res[2];

        var time = dateFormat(new Date(), 'HH:MM:ss');
        var status = res[1] === 'r' ? 'Recording' : 'Skipping ';
        console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentSong}`);
      }
    }
  });

  streamripperProc.on('error', function (err) {
    cb(err);
    return;
  });

  streamripperProc.on('exit', function () {
    console.log('Streamripper exited.');
    cb(null);
    return;
  });
}

function init(args, options) {
  if (options.version) {
    console.log(pkg.version);
    process.exit();
  }

  if (options.help) {
    showHelp();
    process.exit();
  }

  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  if (args.indexOf('list') === 0) {
    list();
    return;
  }

  if ((args.indexOf('get') === 0 || args.indexOf('show') === 0) && args[1]) {
    get();
    return;
  }

  if (args.indexOf('play') === 0 && args[1]) {
    somafm.getChannel(args[1], function (err, channel) {
      if (err) {
        console.error(err.toString());
        process.exit(10);
      }

      play(channel, function (err) {
        if (err) {
          console.error(err.toString());
          process.exit(30);
        }
      });
    });
    return;
  }

  if (args.indexOf('record') === 0 && args[1]) {
    somafm.getChannel(args[1], function (err, channel) {
      if (err) {
        console.error(err.toString());
        process.exit(10);
      }

      record(channel, function (err) {
        if (err) {
          console.error(err.toString());
          process.exit(40);
        }
      });
    });
    return;
  }

  if (args.indexOf('raw') === 0) {
    somafm.getChannels({sortChannels: false, raw: true},
      function (err, channels) {
        if (err) {
          throw err;
        }

        somafm.dump(channels);
      }
    );
    return;
  }

  if (args.indexOf('debug') === 0) {
    somafm.getChannels({sortChannels: true},
      function (err, res) {
        if (err) {
          throw err;
        }

        console.dir(res);
      }
    );
    return;
  }

  showHelp();
  process.exit(1);
}

init(args, options);
