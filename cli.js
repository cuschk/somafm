#!/usr/bin/env node
'use strict';
const childProcess = require('child_process');
const chalk = require('chalk');
const meow = require('meow');
const inquirer = require('inquirer');
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
const somafm = require('.');

const FIGURE_HEART = '❤';
const FIGURE_PLAY = '▶';

const cli = meow(`
  Usage
    $ somafm [<command> <args>]

  Example
    $ somafm
    $ somafm list
    $ somafm list ambient
    $ somafm info groovesalad
    $ somafm play fluid

  Commands
    list [<keywords>]   list channels, optionally filter by keywords
    info <channel>      show channel information
    play <channel>      play channel
    record <channel>    start recording channel
    list-favourites     list your favourite songs
    edit-favourites     edit your favourite songs
`, {
  alias: {
    h: 'help',
    v: 'version'
  }
});

const mplayerBin = 'mplayer';
const streamripperBin = 'streamripper';

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
  somafm.getChannels({search, sortChannels: true})
    .then(showChannelList)
    .catch(err => {
      console.error(err.toString());
      process.exit(20);
    });
}

function info(channelId) {
  somafm.getChannel(channelId)
    .then(channel => {
      showChannel(channel);
    })
    .catch(err => {
      console.error(err.toString());
      process.exit(10);
    });
}

function play(channelId) {
  somafm.getChannel(channelId)
    .then(playChannel)
    .catch(err => {
      console.error(err.toString());
      process.exit(10);
    });
}

function playChannel(channel) {
  return new Promise((resolve, reject) => {
    if (!isBin(mplayerBin)) {
      reject(new Error('MPlayer executable not found. Please ensure MPlayer is installed on your system and runnable with the "mplayer" command.'));
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

      if (['f', '+'].indexOf(key) > -1) {
        utils.addToFavourites(currentTitle);
        currentFavourite = true;

        logTitle(currentTime, currentTitleOut, true, true);
        windowTitle(currentTitleOut, true);
      }

      if (['u', '-'].indexOf(key) > -1) {
        utils.removeFromFavourites(currentTitle);
        currentFavourite = false;

        logTitle(currentTime, currentTitleOut, false, true);
        windowTitle(currentTitleOut);
      }

      // ctrl+c, esc, q
      if (['\u0003', '\u001b', 'q'].indexOf(key) > -1) {
        logTitle(currentTime, currentTitleOut, currentFavourite);
        logUpdate.done();

        mplayerProc.kill();
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

    mplayerProc.on('error', reject);

    mplayerProc.on('exit', () => {
      termTitle();
      process.exit(0);
    });
  });
}

function interactive() {
  somafm.getChannels({sortChannels: true})
    .then(showPrompt)
    .then(answers => {
      play(answers.channel);
    })
    .catch(err => {
      console.error(err.toString());
      process.exit(20);
    });
}

function showPrompt(channels) {
  inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

  const lines = channels.map(channel => ({
    name: `${channel.title} (${chalk.blue(channel.genre)})`,
    value: channel.id,
    short: channel.title
  }));

  return inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'channel',
      message: 'Channel  ',
      source: (answers, input) => Promise.resolve().then(() => filerLines(input, lines))
    }
  ]);
}

function filerLines(input, lines) {
  if (input !== null) {
    return lines.filter(channel => channel.name.toLowerCase().includes(input.toLowerCase()));
  }

  return lines;
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
      prefix = `${chalk.red(FIGURE_HEART)} `;
      break;
    case 2:
      prefix = `${chalk.green(FIGURE_PLAY)} `;
      break;
    case 3:
      prefix = `${chalk.green(FIGURE_HEART)} `;
      break;
    default:
  }

  logUpdate(`  ${time}  ${prefix}${title}`);
}

function windowTitle(title, favourite) {
  termTitle(`${favourite ? FIGURE_HEART : FIGURE_PLAY} ${title}`);
}

function record(channel) {
  return new Promise((resolve, reject) => {
    if (!isBin(streamripperBin)) {
      reject(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
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

      const regex = /^\[(r|sk)ipping.*] (.*) \[(.{7})]$/m;
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

    streamripperProc.on('error', reject);

    streamripperProc.on('exit', resolve);
  });
}

function init() {
  if (cli.input.length === 0) {
    interactive();
    return;
  }

  if (['list', 'l'].indexOf(cli.input[0]) > -1) {
    list(cli.input.slice(1));
    return;
  }

  if (['info', 'i'].indexOf(cli.input[0]) > -1 && cli.input[1]) {
    info(cli.input[1]);
    return;
  }

  if (['play', 'p'].indexOf(cli.input[0]) > -1 && cli.input[1]) {
    play(cli.input[1]);
    return;
  }

  if (['record', 'r'].indexOf(cli.input[0]) > -1 && cli.input[1]) {
    somafm.getChannel(cli.input[1], (err, channel) => {
      if (err) {
        console.error(err.toString());
        process.exit(10);
      }

      record(channel)
        .catch(err => {
          console.error(err.toString());
          process.exit(40);
        });
    });
    return;
  }

  if (['list-favourites', 'list-favorites', 'lf'].indexOf(cli.input[0]) > -1) {
    utils.getFavourites().then(favourites => {
      console.log();
      favourites.forEach(title => {
        console.log(`  ${chalk.red(FIGURE_HEART)} ${title}`);
      });
    });
    return;
  }

  if (['edit-favourites', 'edit-favorites', 'ef'].indexOf(cli.input[0]) > -1) {
    editor(utils.getFavouritesFile());
    return;
  }

  cli.showHelp();
  process.exit(1);
}

init();
