#!/usr/bin/env node
'use strict';
const childProcess = require('child_process');
const chalk = require('chalk');
const meow = require('meow');
const ora = require('ora');
const inquirer = require('inquirer');
const isBin = require('isbin');
const dateFormat = require('dateformat');
const trim = require('trim');
const termTitle = require('term-title');
const cliTruncate = require('cli-truncate');
const copy = require('copy-paste').copy;
const logUpdate = require('log-update');
const cliCursor = require('cli-cursor');
const notifier = require('node-notifier');
const editor = require('editor');
const figures = require('./figures');
const utils = require('./utils');
const somafm = require('.');

const cli = meow(`
  Usage
    $ somafm [<command> <args>] [<options>]

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

  Options
    -n   Don't show desktop notifications
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

const spinner = ora({color: 'yellow'});

let notify = (data, favourite) => {
  if (favourite) {
    data.title = `${figures.heart} ${data.title}`;
  }

  notifier.notify(data);
};

function getWidth(stream) {
  const columns = stream.columns;

  if (!columns) {
    return 80;
  }

  if (process.platform === 'win32') {
    return columns - 1;
  }

  return columns;
}

function showChannelList(channels) {
  for (const channel of channels) {
    const str = `${chalk.bold(channel.title)} [${chalk.green(channel.id)}] (${chalk.blue(channel.genre)}) - ${(channel.description)}`;

    console.log(cliTruncate(str, getWidth(process.stdout)));
  }
}

function showChannel(channel) {
  console.log(
`  ${chalk.bold(channel.fullTitle)} [${chalk.green(channel.id)}]

  ${chalk.blue(channel.description)}

    ${chalk.yellow('Now playing')}   ${channel.lastPlaying}

             ${chalk.yellow('DJ')}   ${channel.dj}
          ${chalk.yellow('Genre')}   ${channel.genre}
      ${chalk.yellow('Listeners')}   ${channel.listeners}

     ${chalk.yellow('Stream URL')}   ${channel.stream.urls[0]}`
  );
}

function list(search) {
  spinner.start('Loading channels');

  somafm.getChannels({search, sortChannels: true})
    .then(channels => {
      spinner.stop();
      return Promise.resolve(channels);
    })
    .then(showChannelList)
    .catch(err => {
      spinner.fail(err.toString());
      process.exit(20);
    });
}

function info(channelId) {
  spinner.start('Loading channel information');

  somafm.getChannel(channelId)
    .then(channel => {
      spinner.stop();
      showChannel(channel);
    })
    .catch(err => {
      spinner.fail(err.toString());
      process.exit(10);
    });
}

function play(channelId) {
  spinner.start('Loading channel information');

  somafm.getChannel(channelId)
    .then(channel => {
      spinner.stop();
      return channel;
    })
    .then(playChannel)
    .catch(err => {
      spinner.fail(err.toString());
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

    reject(new Error('No player executable found. Please ensure MPlayer or mpv is installed on your system and runnable within your shell.'));
  });
}

function playChannel(channel) {
  return getPlayer()
    .then(player => {
      let currentTitle = '';
      let currentTitleOut;
      let currentTime;
      let currentFavourite;

      cliCursor.hide();
      console.log(`  Playing   ${chalk.bold(channel.fullTitle)}\n\n  ${chalk.blue(channel.description)}\n`);

      const args = player.args.concat(channel.stream.urls[0]);
      const playerProc = childProcess.spawn(player.cmd, args);

      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf-8');

      stdin.on('data', key => {
        if (player.keyPress && ['m', '9', '0', '/', '*'].indexOf(key) > -1) {
          playerProc.stdin.write(key);
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

        // `ctrl`+`c`, `esc`, `q`
        if (['\u0003', '\u001b', 'q'].indexOf(key) > -1) {
          if (currentTitleOut) {
            logTitle(currentTime, currentTitleOut, currentFavourite);
          }
          logUpdate.done();

          playerProc.kill();
        }
      });

      playerProc.stdout.on('data', data => {
        const line = trim(data.toString());

        const res = line.match(player.titleRegex);
        let title;

        if (res && (title = res[1])) {
          const time = dateFormat(new Date(), 'HH:MM:ss');
          const titleOut = title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i')) ? chalk.gray(title) : title;

          // Overwrite last line
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
          notify({
            title: currentTitle,
            message: channel.fullTitle,
            icon: channel.imageFile
          }, currentFavourite);
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
  spinner.start('Loading channels');

  somafm.getChannels({sortChannels: true})
    .then(channels => {
      spinner.stop();
      return channels;
    })
    .then(showPrompt)
    .then(answers => {
      console.log();
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
      prefix = `${chalk.red(figures.heart)} `;
      break;
    case 2:
      prefix = `${chalk.green(figures.play)} `;
      break;
    case 3:
      prefix = `${chalk.green(figures.heart)} `;
      break;
    default:
  }

  logUpdate(`  ${time}  ${prefix}${title}`);
}

function windowTitle(title, favourite) {
  termTitle(`${favourite ? figures.heart : figures.play} ${title}`);
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
    console.log(
`  Recording ${chalk.bold(channel.fullTitle)}
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
  if (cli.flags.n) {
    // Disable desktop notifications
    notify = () => {};
  }

  console.log();

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
      for (const title of favourites) {
        console.log(`  ${chalk.red(figures.heart)} ${title}`);
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
