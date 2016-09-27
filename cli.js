#!/usr/bin/env node
'use strict';
var childProcess = require('child_process');
var chalk = require('chalk');
var minimist = require('minimist');
var isBin = require('isbin');
var dateFormat = require('dateformat');
var trim = require('trim');
var termTitle = require('term-title');
var cliTruncate = require('cli-truncate');
var copy = require('copy-paste').copy;
var pkg = require('./package.json');
var somafm = require('./');

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
    info <channel>      show channel information
    play <channel>      play channel
    record <channel>    start recording channel

  Examples
    somafm list
    somafm info groovesalad
    somafm play fluid`
  );
}

function showChannelList(channels) {
  console.log();

  channels.forEach(function (channel) {
    var str = `${chalk.bold(channel.title)} [${chalk.green(channel.id)}] (${chalk.blue(channel.genre)}) - ${(channel.description)}`;

    if (process.stdout.columns) {
      console.log(cliTruncate(str, process.stdout.columns));
    } else {
      console.log(str);
    }
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

     ${chalk.yellow('Stream URL')}   ${channel.stream.url}`
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

function info() {
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

  var currentTitle;

  console.log(`\n  Playing ${chalk.bold(channel.fullTitle)}\n`);

  var args = [
    '-quiet',
    '-playlist',
    channel.stream.url
  ];
  var mplayerProc = childProcess.spawn(mplayerBin, args);

  var stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');

  stdin.on('data', function (key) {
    if (['m', '9', '0'].indexOf(key) > -1) {
      mplayerProc.stdin.write(key);
    }

    if (key === 'c') {
      copy(currentTitle);
    }

    // ctrl+c
    if (key === '\u0003' || key === 'q') {
      mplayerProc.kill();
      process.exit();
    }
  });

  mplayerProc.stdout.on('data', function (data) {
    var line = data.toString();

    var regex = /StreamTitle='(.*)';StreamUrl=/;
    var res = line.match(regex);
    var title;

    if (res && (title = res[1])) {
      var time = dateFormat(new Date(), 'HH:MM:ss');

      var titleOut = title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i')) ? `>> ${title}` : title;
      var titleHead = `▶ ${title}`;

      console.log(`  ${chalk.yellow(time)}  ${titleOut}`);
      termTitle(titleHead);

      currentTitle = title;
    }
  });

  mplayerProc.on('error', function (err) {
    cb(err);
  });

  mplayerProc.on('exit', function () {
    termTitle();
    cb(null);
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
  var streamripperProc = childProcess.spawn(streamripperBin, args, {stdio: [process.stdin, 'pipe', 'pipe']});
  var currentStatus;
  var currentTitle;

  console.log(`
  Recording ${chalk.bold(channel.fullTitle)}
  to directory ${chalk.yellow(`${channel.fullTitle}/${date}`)}\n`
  );

  streamripperProc.stdout.on('data', function (data) {
    var line = data.toString();

    var regex = /^\[(r|sk)ipping.*\] (.*) \[(.{7})\]$/m;
    var res = line.match(regex);

    if (res && res[1] && res[2]) {
      if ((currentStatus !== res[1] || currentTitle !== res[2]) && res[2].length > 1) {
        if (res[3] && trim(res[3]) === '0b') {
          return;
        }

        currentStatus = res[1];
        currentTitle = res[2];

        var time = dateFormat(new Date(), 'HH:MM:ss');
        var status = res[1] === 'r' ? 'Recording' : 'Skipping ';
        console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentTitle}`);
      }
    }
  });

  streamripperProc.on('error', function (err) {
    cb(err);
  });

  streamripperProc.on('exit', function () {
    console.log('Streamripper exited.');
    cb(null);
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

  if ((args.indexOf('info') === 0) && args[1]) {
    info();
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

  showHelp();
  process.exit(1);
}

init(args, options);
