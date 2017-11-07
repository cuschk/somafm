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
const scribble = require('./scribble');
const figures = require('./figures');
const utils = require('./utils');
const somafm = require('.');

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

const players = [
  {
    cmd: 'mplayer',
    args: ['-quiet'],
    titleRegex: /StreamTitle='(.*)';StreamUrl=/,
    keyPress: true
  },
  {
    cmd: 'mpv',
    args: ['--msg-level=all=info'],
    titleRegex: /.*icy-title: (.*)$/
  }
];
const streamripperBin = 'streamripper';
let currentlyPlaying = false;
let currentlyRecording = false;
somafm.currentChannelId = '';
let previousTrack = '';

let Scrobbler = null;

if (somafm.settings.lastFm.enableScrobbling
  && somafm.settings.lastFm.apiKey.length
  && somafm.settings.lastFm.apiSecret.length
  && somafm.settings.lastFm.username.length
  && somafm.settings.lastFm.password.length
  ) {
  Scrobbler = new scribble(
    somafm.settings.lastFm.apiKey,
    somafm.settings.lastFm.apiSecret,
    somafm.settings.lastFm.username,
    somafm.settings.lastFm.password
  );
}

function showChannelList(channels) {
  console.log();

  for (const channel of channels) {
    const str = `${chalk.bold(channel.title)} [${chalk.green(channel.id)}] (${chalk.blue(channel.genre)}) - ${(channel.description)}`;

    if (process.stdout.columns) {
      console.log(cliTruncate(str, process.stdout.columns - 1));
    } else {
      console.log(str);
    }
  }
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

     ${chalk.yellow('Stream URL')}   ${channel.stream.urls[0]}`
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

function getPlayer() {
  return new Promise((resolve, reject) => {
    for (const player of players) {
      if (isBin(player.cmd)) {
        resolve(player);
      }
    }

    reject(new Error('No player executable found. Please ensure mpv or MPlayer is installed on your system and runnable within your shell.'));
  });
}

function playChannel(channel) {
  somafm.settings.currentChannelId = channel.id;
  return getPlayer()
    .then(player => {
      let currentTitle = '';
      let currentTitleOut;
      let currentTime;
      let currentFavourite;
      let currentLoved;

      cliCursor.hide();
      console.log(`\n  Playing   ${chalk.bold(channel.fullTitle)}\n`);

      const args = player.args.concat(channel.stream.urls[0]);
      const playerProc = childProcess.spawn(player.cmd, args);

      currentlyPlaying = true;

      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf-8');

      stdin.on('data', key => {
        let userCommand = '';

        for (let command in somafm.settings.keyMap) {
          if (somafm.settings.keyMap.hasOwnProperty(command)) {
            let userKey = somafm.settings.keyMap[command];
            if (typeof userKey === 'object') {
              userKey.forEach(function(userListKey) {
                if (key === userListKey) userCommand = command
              }, this);
            } else if (typeof userKey === 'string') {
              if (key === userKey) userCommand = command
            }
          }
        }

        // Always quit on CTRL+C or ESC
        if (['\u0003', '\u001b'].indexOf(key) > -1) userCommand = 'quit';

        switch (userCommand) {
          case 'copyToClipboard':
            copy(currentTitle);
            break;

          case 'lastFmLoveSong':
            if (somafm.settings.lastFm.enableScrobbling
            && somafm.settings.lastFm.apiKey.length
            && somafm.settings.lastFm.apiSecret.length
            && somafm.settings.lastFm.username.length
            && somafm.settings.lastFm.password.length) {
              currentLoved = true;
              loveSong(getLastFmObject(currentTitle))
              logTitle(currentTime, currentTitleOut, true, currentFavourite, currentlyRecording, currentLoved);
            }
            break;

          case 'addFavorite':
            utils.addToFavourites(currentTitle);
            currentFavourite = true;

            logTitle(currentTime, currentTitleOut, true, true, currentlyRecording, currentLoved);
            windowTitle(currentTitleOut, true, currentlyRecording, currentLoved);
            break;

          case 'removeFavorite':
            utils.removeFromFavourites(currentTitle);
            currentFavourite = false;

            logTitle(currentTime, currentTitleOut, false, true, currentlyRecording, currentLoved);
            windowTitle(currentTitleOut, false, currentlyRecording, currentLoved);
            break;

          case 'record':
            currentlyRecording = true
            somafm.getChannel(somafm.settings.currentChannelId)
            .then(channel => {
              record(channel);
            })
            .catch(err => {
              console.error(err.toString());
              process.exit(10);
            });
            break;

          case 'increaseVolume':
            if (player.keyPress) {
              playerProc.stdin.write('*');
              // playerProc.stdin.write('0');
            }
            break;

          case 'decreaseVolume':
            if (player.keyPress) {
              playerProc.stdin.write('/');
              // playerProc.stdin.write('9');
            }
            break;

          case 'toggleMute':
            if (player.keyPress) {
              playerProc.stdin.write('m');
            }
            break;

          case 'quit':
            if (currentTitleOut) {
              logTitle(currentTime, currentTitleOut, currentFavourite, currentlyPlaying, currentlyRecording, currentLoved);
            }
            logUpdate.done();

            playerProc.kill();
            break;

          default:
            break;
        }
      });

      playerProc.stdout.on('data', data => {
        const line = trim(data.toString());

        const res = line.match(player.titleRegex);
        let title;

        if (res && (title = res[1])) {
          const time = dateFormat(new Date(), 'HH:MM:ss');
          const somaAd = title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i')) ? true : false;
          let titleOut = title;
          if (somaAd) titleOut = chalk.gray(title);

          // Overwrite last line
          if (currentTime) {
            logTitle(currentTime, currentTitleOut, currentFavourite, currentlyRecording, currentLoved);
          }

          currentTitle = title;
          currentTime = chalk.yellow(time);
          currentTitleOut = titleOut;

          currentFavourite = utils.isFavourite(currentTitle);

          logUpdate.done();
          logTitle(currentTime, currentTitleOut, currentFavourite, true, currentlyRecording, currentLoved);
          windowTitle(currentTitle, currentFavourite, currentlyRecording, currentLoved);
        }
      });

      playerProc.on('error', Promise.reject);

      playerProc.on('exit', () => {
        termTitle();
        process.exit(0);
      });

      return Promise.resolve();
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

function loveSong(song) {
  Scrobbler.Love(song, function(response) {
    if (response.indexOf('lfm status="ok"') === -1) {
      console.log(`${chalk.red('Error loving the song')} `)
    }
  });
}

function showHelp() {
  console.log('This is the help!');
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

function getLastFmObject (title) {
  let titleParts = title.split(' - ');
  let artist = titleParts[0];
  titleParts.shift();
  let track = (titleParts.join(' - ')).replace(/ - /,'');

  return {
    artist: artist,
    track: track
  };
}

function logTitle(time, title, favourite, playing, recording, loved) {
  let state = 0;
  let prefix = '';

  const somaAd = title.match(new RegExp(`SomaFM|Big Url|${title}`, 'i')) ? true : false;

  if (favourite) prefix += `${chalk.green(figures.favourite)} `;
  if (playing) prefix += `${chalk.green(figures.play)} `;

  let newTitle = ` ${time}  ${prefix}${title} `;

  if (loved) newTitle += `${chalk.red(figures.love)} `

  if (recording) newTitle += `${chalk.yellow(figures.record)} `;

  logUpdate(newTitle);

  if (somafm.settings.lastFm.enableScrobbling && Scrobbler !== null && !somaAd) {
    let scrobble = getLastFmObject(title);

    if (title !== previousTrack) {
      previousTrack = title;
      // currentLoved = false;
      // currentFavourite = false;
      // TODO: Figure out why Now Playing is giving "invalid signature"
      Scrobbler.Scrobble(scrobble, function(response) {
        if (response.indexOf('lfm status="ok"') === -1) {
          console.log(`${chalk.red('Scrobbling error')} `)
        }
      });
    }
  }
}

function windowTitle(title, favourite, recording, loved) {
  termTitle(`${favourite ? figures.favourite : figures.play} ${title} ${loved ? figures.love : ''} ${recording ? figures.record : ''}`);
}

function record(channel) {
  let playing = currentlyPlaying
  return new Promise((resolve, reject) => {
    if (!isBin(streamripperBin)) {
      reject(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
    }

    const date = dateFormat(new Date(), 'yyyymmdd_HHMMss');
    const args = [
      channel.stream.url,
      '-D', `${somafm.settings.audioDir}/%1q %A - %T`
    ];
    const streamripperProc = childProcess.spawn(streamripperBin, args, {stdio: [process.stdin, 'pipe', 'pipe']});
    let currentStatus;
    let currentTitle;

    cliCursor.hide();

    console.log(`
    ${chalk.red(figures.record)} Recording ${chalk.bold(channel.fullTitle)}
    to directory ${chalk.yellow(`${somafm.settings.audioDir}`)}\n
    Recording will begin at the start of the next track`
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
          if (!playing) console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentTitle}`);
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

  if (['list', 'ls', 'l'].indexOf(cli.input[0]) > -1) {
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
    somafm.getChannel(cli.input[1])
      .then(channel => {
        currentlyRecording = true
        record(channel);
      })
      .catch(err => {
        console.error(err.toString());
        process.exit(10);
      });
    return;
  }

  if (['list-favourites', 'list-favorites', 'lf'].indexOf(cli.input[0]) > -1) {
    utils.getFavourites().then(favourites => {
      console.log();
      for (const title of favourites) {
        console.log(`  ${chalk.red(figures.favourite)} ${title}`);
      }
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
