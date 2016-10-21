#!/usr/bin/env node
'use strict';
const childProcess = require('child_process');
const chalk = require('chalk');
const minimist = require('minimist');
const isBin = require('isbin');
const dateFormat = require('dateformat');
const trim = require('trim');
const termTitle = require('term-title');
const cliTruncate = require('cli-truncate');
const copy = require('copy-paste').copy;
const logUpdate = require('log-update');
const cliCursor = require('cli-cursor');
const editor = require('editor');
const utils = require('./utils');
const pkg = require('./package.json');
const somafm = require('./');

const options = minimist(process.argv.slice(2));
const args = options._;
delete options._;

const mplayerBin = 'mplayer';
const streamripperBin = 'streamripper';

function showHelp() {
  console.log(
  `
  ${pkg.description}

  Usage
    somafm <command> [<args>]

  Commands
    list [<keywords>]   list channels, optionally filter by keywords
    info <channel>      show channel information
    play <channel>      play channel
    record <channel>    start recording channel
    list-favourites     list your favourite songs
    edit-favourites     edit your favourite songs

  Examples
    somafm list
    somafm list ambient
    somafm info groovesalad
    somafm play fluid`
  );
}

function showChannelList(channels) {
  console.log();

  channels.forEach(channel => {
    const str = `${chalk.bold(channel.title)} [${chalk.green(channel.id)}] (${chalk.blue(channel.genre)}) - ${(channel.description)}`;

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

function list(search) {
  somafm.getChannels({search, sortChannels: true}, (err, res) => {
    if (err) {
      console.error(err.toString());
      process.exit(20);
    }

    showChannelList(res);
  });
}

function info() {
  somafm.getChannel(args[1], (err, channel) => {
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

  let currentTitle = '';
  let currentTitleOut;
  let currentTime;
  let currentFavourite;

  cliCursor.hide();
  console.log(`\n  Playing   ${chalk.bold(channel.fullTitle)}\n`);

  const args = [
    '-quiet',
    '-playlist',
    channel.stream.url
  ];
  const mplayerProc = childProcess.spawn(mplayerBin, args);

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');

  stdin.on('data', key => {
    if (['m', '9', '0', '/', '*'].indexOf(key) > -1) {
      mplayerProc.stdin.write(key);
    }

    if (key === 'c') {
      copy(currentTitle);
    }

    if (key === 'f' || key === '+') {
      utils.addToFavourites(currentTitle);
      currentFavourite = true;

      logTitle(currentTime, currentTitleOut, true, true);
      windowTitle(currentTitleOut, true);
    }

    if (key === 'u' || key === '-') {
      utils.removeFromFavourites(currentTitle);
      currentFavourite = false;

      logTitle(currentTime, currentTitleOut, false, true);
      windowTitle(currentTitleOut);
    }

    // ctrl+c, esc
    if (key === '\u0003' || key === '\u001b' || key === 'q') {
      logTitle(currentTime, currentTitleOut, currentFavourite);
      logUpdate.done();

      mplayerProc.kill();
      process.exit();
    }
  });

  mplayerProc.stdout.on('data', data => {
    const line = data.toString();

    const regex = /StreamTitle='(.*)';StreamUrl=/;
    const res = line.match(regex);
    let title;

    if (res && (title = res[1])) {
      const time = dateFormat(new Date(), 'HH:MM:ss');
      const titleOut = title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i')) ? chalk.gray(title) : title;

      // overwrite last line
      if (currentTime) {
        logTitle(currentTime, currentTitleOut, currentFavourite);
      }

      currentTitle = title;
      currentTime = chalk.yellow(time);
      currentTitleOut = titleOut;

      currentFavourite = utils.isFavourite(currentTitle);

      logUpdate.done();
      logTitle(currentTime, currentTitleOut, currentFavourite, true);
      windowTitle(currentTitle, currentFavourite);
    }
  });

  mplayerProc.on('error', err => {
    cb(err);
  });

  mplayerProc.on('exit', () => {
    termTitle();
    cb(null);
  });
}

function logTitle(time, title, favourite, playing) {
  let state = 0;
  let prefix = '';

  if (favourite) {
    state++;
  }
  if (playing) {
    state += 2;
  }

  switch (state) {
    case 1:
      prefix = `${chalk.red('❤')} `;
      break;
    case 2:
      prefix = `${chalk.green('▶')} `;
      break;
    case 3:
      prefix = `${chalk.green('❤')} `;
      break;
    default:
  }

  logUpdate(`  ${time}  ${prefix}${title}`);
}

function windowTitle(title, favourite) {
  termTitle(`${favourite ? '❤' : '▶'} ${title}`);
}

function record(channel, cb) {
  if (!isBin(streamripperBin)) {
    cb(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
    return;
  }

  const date = dateFormat(new Date(), 'yyyymmdd_HHMMss');
  const args = [
    channel.stream.url,
    '-D', `${channel.fullTitle}/${date}/%1q %A - %T`
  ];
  const streamripperProc = childProcess.spawn(streamripperBin, args, {stdio: [process.stdin, 'pipe', 'pipe']});
  let currentStatus;
  let currentTitle;

  cliCursor.hide();
  console.log(`
  Recording ${chalk.bold(channel.fullTitle)}
  to directory ${chalk.yellow(`${channel.fullTitle}/${date}`)}\n`
  );

  streamripperProc.stdout.on('data', data => {
    const line = data.toString();

    const regex = /^\[(r|sk)ipping.*\] (.*) \[(.{7})\]$/m;
    const res = line.match(regex);

    if (res && res[1] && res[2]) {
      if ((currentStatus !== res[1] || currentTitle !== res[2]) && res[2].length > 1) {
        if (res[3] && trim(res[3]) === '0b') {
          return;
        }

        currentStatus = res[1];
        currentTitle = res[2];

        const time = dateFormat(new Date(), 'HH:MM:ss');
        const status = res[1] === 'r' ? 'Recording' : 'Skipping ';
        console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentTitle}`);
      }
    }
  });

  streamripperProc.on('error', err => {
    cb(err);
  });

  streamripperProc.on('exit', () => {
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

  if (['list', 'l'].indexOf(args[0]) > -1) {
    list(args.slice(1));
    return;
  }

  if (['info', 'i'].indexOf(args[0]) > -1 && args[1]) {
    info();
    return;
  }

  if (['play', 'p'].indexOf(args[0]) > -1 && args[1]) {
    somafm.getChannel(args[1], (err, channel) => {
      if (err) {
        console.error(err.toString());
        process.exit(10);
      }

      play(channel, err => {
        if (err) {
          console.error(err.toString());
          process.exit(30);
        }
      });
    });
    return;
  }

  if (['record', 'r'].indexOf(args[0]) > -1 && args[1]) {
    somafm.getChannel(args[1], (err, channel) => {
      if (err) {
        console.error(err.toString());
        process.exit(10);
      }

      record(channel, err => {
        if (err) {
          console.error(err.toString());
          process.exit(40);
        }
      });
    });
    return;
  }

  if (['list-favourites', 'list-favorites', 'lf'].indexOf(args[0]) > -1) {
    utils.getFavourites(favourites => {
      console.log();
      favourites.forEach(title => {
        console.log(`  ${chalk.red('❤')} ${title}`);
      });
    });
    return;
  }

  if (['edit-favourites', 'edit-favorites', 'ef'].indexOf(args[0]) > -1) {
    editor(utils.getFavouritesFile());
    return;
  }

  showHelp();
  process.exit(1);
}

init(args, options);
