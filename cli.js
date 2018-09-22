#!/usr/bin/env node
'use strict';
const childProcess = require('child_process');
const chalk = require('chalk');
const meow = require('meow');
const ora = require('ora');
const inquirer = require('inquirer');
const isBin = require('isbin');
const dateFormat = require('date-fns/format');
const trim = require('trim');
const termTitle = require('term-title');
const cliTruncate = require('cli-truncate');
const {copy} = require('copy-paste');
const logUpdate = require('log-update');
const cliCursor = require('cli-cursor');
const indentString = require('indent-string');
const wrapAnsi = require('wrap-ansi');
const notifier = require('node-notifier');
const openEditor = require('open-editor');
const figures = require('./figures');
const favourites = require('./favourites');
const utils = require('./utils');
const somafm = require('.');

const cli = meow(`
  Usage
    $ somafm [<command> <args>] [<options>]

  Example
    $ somafm
    $ somafm -n
    $ somafm list
    $ somafm list ambient
    $ somafm info groovesalad
    $ somafm play fluid

  Commands
    list | ls [<keywords>]
              List channels, optionally filter by keywords
    info | i <channel>
              Show channel information
    play | p <channel>
              Play channel
    record | r <channel>
              Start recording channel
    list-favourites | lf [<keywords>]
              List your favourite songs, optionally filter by keywords
    edit-favourites | ef
              Edit your favourite songs

  Options
    -n   Don't show desktop notifications

  Keyboard shortcuts
    When playing, the following keyboard shortcuts are available:

    c         Copy current song title to clipboard
    + | f     Add current song to favourites
    - | u     Remove current song from favourites
    * | 0     Increase volume*
    / | 9     Decrease volume*
    m         Mute/unmute*
    q | esc   Stop playback & quit application

    * MPlayer only
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
  const columns = stream.columns; // eslint-disable-line prefer-destructuring

  if (!columns) {
    return 80;
  }

  if (process.platform === 'win32') {
    return columns - 1;
  }

  return columns;
}

function wrap(str, options) {
  options = Object.assign({
    width: getWidth(process.stdout),
    marginLeft: 2,
    marginRight: 2
  }, options);

  return indentString(wrapAnsi(str, options.width - options.marginLeft - options.marginRight), options.marginLeft);
}

function showChannelList(channels) {
  for (const channel of channels) {
    console.log(cliTruncate(
      `  ${chalk.bold(channel.title)} [${chalk.green(channel.id)}] (${chalk.blue(channel.genre)}) ${chalk.dim('· ' + channel.description)}`,
      getWidth(process.stdout)
    ));
  }
}

function showChannel(channel) {
  console.log(
    `  ${chalk.bold(channel.fullTitle)} [${chalk.green(channel.id)}]

${wrap(chalk.blue(channel.description))}

    ${chalk.yellow('Now playing')}   ${trim.left(wrap(channel.lastPlaying, {marginLeft: 18}))}

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
      return channels;
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

      console.log(`  Playing   ${chalk.bold(channel.fullTitle)}\n`);
      console.log(wrap(`${chalk.blue(channel.description)}\n`));

      const args = player.args.concat(channel.stream.urls[0]);
      const playerProc = childProcess.spawn(player.cmd, args);

      const stdin = process.stdin; // eslint-disable-line prefer-destructuring
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
          favourites.addToFavourites({title: currentTitle, channel});
          currentFavourite = true;

          logTitle(currentTime, currentTitleOut, true, true);
          windowTitle(currentTitleOut, true);
        }

        if (['u', '-'].indexOf(key) > -1) {
          favourites.removeFromFavourites(currentTitle);
          currentFavourite = false;

          logTitle(currentTime, currentTitleOut, false, true);
          windowTitle(currentTitleOut);
        }

        // `ctrl`+`c`, `esc`, `q`
        if (['\u0003', '\u001B', 'q'].indexOf(key) > -1) {
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
          const time = dateFormat(new Date(), 'HH:mm:ss');
          const titleOut = title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i')) ? chalk.gray(title) : title;

          // Overwrite last line
          if (currentTime) {
            logTitle(currentTime, currentTitleOut, currentFavourite);
          }

          currentTitle = title;
          currentTime = chalk.yellow(time);
          currentTitleOut = titleOut;

          currentFavourite = favourites.isFavourite(currentTitle);

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

  const lines = channels.map(channel => (
    Object.assign(channel, {
      name: cliTruncate(`${chalk.bold(channel.title)} (${chalk.blue(channel.genre)}) ${chalk.dim('· ' + channel.description)}`, getWidth(process.stdout) - 3),
      value: channel.id,
      short: channel.title
    })
  ));

  return inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'channel',
      message: 'Channel  ',
      source: (answers, input) => somafm.filterChannels(lines, input)
    }
  ]);
}

function logTitle(time, title, favourite, playing) {
  let prefix = '';

  if (playing || favourite) {
    const colorFn = playing ? chalk.green : chalk.red;
    const figure = favourite ? figures.heart : figures.play;

    prefix = `${colorFn(figure)} `;
  }

  const outputOptions = {marginLeft: 11, marginRight: 3};

  if (prefix.length > 0) {
    outputOptions.marginLeft += 2;
  }

  logUpdate(` ${time}  ${prefix}${trim.left(wrap(title, outputOptions))}`);
}

function windowTitle(title, favourite) {
  termTitle(`${favourite ? figures.heart : figures.play} ${title}`);
}

function record(channel) {
  return new Promise((resolve, reject) => {
    if (!isBin(streamripperBin)) {
      reject(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
    }

    const date = dateFormat(new Date(), 'YYYYMMDD_HHmmss');
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

          const time = dateFormat(new Date(), 'HH:mm:ss');
          const status = res[1] === 'r' ? 'Recording' : 'Skipping ';
          console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentTitle}`);
        }
      }
    });

    streamripperProc.on('error', reject);

    streamripperProc.on('exit', resolve);
  });
}

function listFavourites(search) {
  favourites.getFavourites({search}).then(favouriteItems => {
    for (const item of favouriteItems) {
      let output = favourites.isObject(item) ? item.title : item;

      if (item.channelTitle && item.channelTitle.length > 0) {
        output += ' ' + chalk.dim('· ' + item.channelTitle + ' · ' + dateFormat(item.timestamp, 'YY/MM/DD'));
      }

      console.log(`  ${chalk.red(figures.heart)} ${trim.left(wrap(output, {marginLeft: 4}))}`);
    }
  });
}

function init() {
  if (cli.flags.n) {
    // Disable desktop notifications
    notify = () => {};
  }

  console.log();

  const [command, ...params] = cli.input;

  if (!command && !cli.flags.v && !cli.flags.h) {
    interactive();
    return;
  }

  if (utils.equalsAny(command, ['list', 'ls', 'l'])) {
    list(cli.input.slice(1));
    return;
  }

  if (utils.equalsAny(command, ['info', 'i']) && params.length > 0) {
    info(params[0]);
    return;
  }

  if (utils.equalsAny(command, ['play', 'p']) && params.length > 0) {
    play(params[0]);
    return;
  }

  if (utils.equalsAny(command, ['record', 'r']) && params.length > 0) {
    somafm.getChannel(params[0])
      .then(channel => {
        record(channel);
      })
      .catch(err => {
        console.error(err.toString());
        process.exit(10);
      });
    return;
  }

  if (utils.equalsAny(command, ['list-favourites', 'list-favorites', 'lf'])) {
    listFavourites(cli.input.slice(1));
    return;
  }

  if (utils.equalsAny(command, ['edit-favourites', 'edit-favorites', 'ef'])) {
    openEditor([favourites.getFavouritesFile()]);
    return;
  }

  cli.showHelp();
  process.exit(1);
}

init();
