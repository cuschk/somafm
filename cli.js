#!/usr/bin/env node
'use strict';
const execa = require('execa');
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
const figures = require('./figures.js');
const favourites = require('./favourites.js');
const utils = require('./utils.js');
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
    list, ls [<keywords>]
              List channels, optionally filter by keywords
    info, i <channel> | random
              Show channel information
    play, p <channel> | random
              Play channel
    record, r <channel> | random
              Start recording channel
    list-favourites, lf [<keywords>]
              List your favourite songs, optionally filter by keywords
    edit-favourites, ef
              Edit your favourite songs

  Options
    -n        Show desktop notifications

  Keyboard shortcuts
    When playing, the following keyboard shortcuts are available:

    c         Copy current song title to clipboard
    + | f     Add current song to favourites
    - | u     Remove current song from favourites
    * | 0     Increase volume*
    / | 9     Decrease volume*
    m         Mute/unmute*
    d         Enable desktop notifications
    n         Disable desktop notifications
    q | esc   Stop playback & quit application
`);

const player = {
  cmd: 'mpv',
  args: ['--msg-level=all=info'],
  titleRegex: /.*icy-title: (.*)$/
};
const streamripperBin = 'streamripper';

const spinner = ora({color: 'yellow'});

const showDesktopNotification = (data, favourite) => {
  if (favourite) {
    data.title = `${figures.favourite} ${data.title}`;
  }

  notifier.notify(data);
};

const noop = () => {};
let notify = noop;

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

function wrap(string_, options) {
  options = {width: getWidth(process.stdout),
    marginLeft: 2,
    marginRight: 2, ...options};

  return indentString(wrapAnsi(string_, options.width - options.marginLeft - options.marginRight), options.marginLeft);
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

        ${chalk.yellow('Web URL')}   ${channel.web}
     ${chalk.yellow('Stream URL')}   ${channel.stream.urls[0]}`
  );
}

async function list(search) {
  spinner.start('Loading channels');

  try {
    const channels = await somafm.getChannels({search, sortChannels: true});
    spinner.stop();
    showChannelList(channels);
  } catch (error) {
    spinner.fail(error.toString());
    process.exit(20);
  }
}

async function info(channelId) {
  spinner.start('Loading channel information');

  try {
    const channel = await somafm.getChannel(channelId);
    spinner.stop();
    showChannel(channel);
  } catch (error) {
    spinner.fail(error.toString());
    process.exit(10);
  }
}

async function play(channelId) {
  spinner.start('Loading channel information');

  try {
    const channel = await somafm.getChannel(channelId);
    spinner.stop();
    playChannel(channel);
  } catch (error) {
    spinner.fail(error.toString());
    process.exit(10);
  }
}

function getPlayer() {
  return new Promise((resolve, reject) => {
    if (isBin(player.cmd)) {
      resolve(player);
    }

    reject(new Error('mpv executable not found. Please ensure mpv is installed on your system and runnable with the "mpv" command.'));
  });
}

async function playChannel(channel) {
  const player = await getPlayer();
  let currentTitle = '';
  let currentOptions = {};

  cliCursor.hide();

  console.log(`  Playing   ${chalk.bold(channel.fullTitle)} [${chalk.green(channel.id)}]\n`);
  console.log(wrap(`${chalk.blue(channel.description)}\n`));

  const args = [...player.args, channel.stream.urls[0]];
  const playerProcess = execa(player.cmd, args);

  const stdin = process.stdin; // eslint-disable-line prefer-destructuring
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');

  stdin.on('data', key => {
    if (key === 'c') {
      copy(currentTitle);
    }

    if (['f', '+'].includes(key)) {
      favourites.addToFavourites({title: currentTitle, channel});

      logTitle(currentTitle, Object.assign(currentOptions, {
        isPlaying: true,
        isFavourite: true
      }));
      windowTitle(currentTitle, currentOptions.isFavourite);
    }

    if (['u', '-'].includes(key)) {
      favourites.removeFromFavourites(currentTitle);
      currentOptions.isFavourite = false;

      logTitle(currentTitle, currentOptions);
      windowTitle(currentTitle, currentOptions.isFavourite);
    }

    if (key === 'n') {
      // Enable desktop notifications
      notify = showDesktopNotification;
    }

    if (key === 'm') {
      // Disable/mute desktop notifications
      notify = noop;
    }

    // `ctrl`+`c`, `esc`, `q`
    if (['\u0003', '\u001B', 'q'].includes(key)) {
      if (currentTitle) {
        logTitle(currentTitle, Object.assign(currentOptions, {isPlaying: false}));
      }

      logUpdate.done();

      playerProcess.cancel();
      setTimeout(() => {
        playerProcess.kill('SIGTERM', {forceKillAfterTimeout: 2000});
      }, 1000);
    }
  });

  playerProcess.stdout.on('data', data => {
    const line = trim(data.toString());

    const result = line.match(player.titleRegex);
    let title;

    if (result && (title = result[1])) {
      const time = dateFormat(new Date(), 'HH:mm:ss');

      // Overwrite last line
      if (currentOptions.time) {
        logTitle(currentTitle, {...currentOptions, isPlaying: false});
      }

      currentTitle = title;
      currentOptions = {
        time,
        isPlaying: true,
        isFavourite: favourites.isFavourite(currentTitle),
        isAnnouncement: title.match(new RegExp(`SomaFM|Big Url|${channel.title}`, 'i'))
      };

      logUpdate.done();
      logTitle(currentTitle, currentOptions);
      windowTitle(currentTitle, currentOptions.isFavourite);
      notify({
        title: currentTitle,
        message: channel.fullTitle,
        icon: channel.imageFile
      }, currentOptions.isFavourite);
    }
  });

  playerProcess.on('error', Promise.reject);

  playerProcess.on('exit', () => {
    termTitle();
    process.exit(0);
  });
}

async function interactive() {
  spinner.start('Loading channels');

  try {
    const channels = await somafm.getChannels({sortChannels: true});
    spinner.stop();
    const answers = await showPrompt(channels);
    console.log();
    play(answers.channel);
  } catch (error) {
    console.error(error.toString());
    process.exit(20);
  }
}

function showPrompt(channels) {
  inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

  const lines = channels.map(channel => Object.assign(channel, {
    name: cliTruncate(`${chalk.bold(channel.title)} (${chalk.blue(channel.genre)}) ${chalk.dim('· ' + channel.description)}`, getWidth(process.stdout) - 3),
    value: channel.id,
    short: channel.title
  })
  );

  return inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'channel',
      message: 'Channel  ',
      source: (answers, input) => somafm.filterChannels(lines, input)
    }
  ]);
}

function logTitle(title, options) {
  options = {time: dateFormat(new Date(), 'HH:mm:ss'),
    isPlaying: false,
    isFavourite: false,
    isAnnouncement: false, ...options};

  let prefix = '';

  if (options.isPlaying || options.isFavourite) {
    const colorFn = options.isPlaying ? chalk.green : chalk.red;
    const figure = options.isFavourite ? figures.favourite : figures.play;

    prefix = `${colorFn(figure)} `;
  }

  if (options.isAnnouncement) {
    title = chalk.gray(title);
  }

  const outputOptions = {marginLeft: 11, marginRight: 3};

  if (prefix.length > 0) {
    outputOptions.marginLeft += 2;
  }

  logUpdate(`  ${chalk.dim(options.time)}  ${prefix}${trim.left(wrap(title, outputOptions))}`);
}

function windowTitle(title, isFavourite) {
  termTitle(`${isFavourite ? figures.favourite : figures.play} ${title}`);
}

function record(channel) {
  return new Promise((resolve, reject) => {
    if (!isBin(streamripperBin)) {
      reject(new Error('Streamripper executable not found. Please ensure Streamripper is installed on your system and runnable with the "streamripper" command.'));
    }

    const date = dateFormat(new Date(), 'yyyyMMdd_HHmmss');
    const args = [
      channel.stream.url,
      '-D',
      `${channel.fullTitle}/${date}/%1q %A - %T`
    ];
    const streamripperProcess = execa(streamripperBin, args, {stdio: [process.stdin, 'pipe', 'pipe']});
    let currentStatus;
    let currentTitle;

    cliCursor.hide();
    console.log(
      `  Recording ${chalk.bold(channel.fullTitle)}
  to directory ${chalk.yellow(`${channel.fullTitle}/${date}`)}\n`
    );

    streamripperProcess.stdout.on('data', data => {
      const line = data.toString();

      const regex = /^\[(r|sk)ipping.*] (.*) \[(.{7})]$/m;
      const result = line.match(regex);

      if (result && result[1] && result[2] && (currentStatus !== result[1] || currentTitle !== result[2]) && result[2].length > 1) {
        if (result[3] && trim(result[3]) === '0b') {
          return;
        }

        currentStatus = result[1];
        currentTitle = result[2];

        const time = dateFormat(new Date(), 'HH:mm:ss');
        const status = result[1] === 'r' ? 'Recording' : 'Skipping ';
        console.log(`  ${chalk.yellow(time)}  ${chalk.bold(status)}  ${currentTitle}`);
      }
    });

    streamripperProcess.on('error', reject);

    streamripperProcess.on('exit', resolve);
  });
}

async function listFavourites(search) {
  const favouriteItems = await favourites.getFavourites({search});

  for (const item of favouriteItems) {
    let output = favourites.isObject(item) ? item.title : item;

    if (item.channelTitle && item.channelTitle.length > 0) {
      output += ' ' + chalk.dim('· ' + item.channelTitle + ' · ' + dateFormat(item.timestamp, 'yy/MM/dd'));
    }

    console.log(`  ${chalk.red(figures.favourite)} ${trim.left(wrap(output, {marginLeft: 4}))}`);
  }
}

async function init() {
  if (cli.flags.n) {
    // Enable desktop notifications
    notify = showDesktopNotification;
  }

  console.log();

  const [command, ...parameters] = cli.input;

  if (!command && !cli.flags.v && !cli.flags.h) {
    interactive();
    return;
  }

  if (utils.equalsAny(command, ['list', 'ls', 'l'])) {
    list(cli.input.slice(1));
    return;
  }

  if (utils.equalsAny(command, ['info', 'i']) && parameters.length > 0) {
    info(parameters[0]);
    return;
  }

  if (utils.equalsAny(command, ['play', 'p']) && parameters.length > 0) {
    play(parameters[0]);
    return;
  }

  if (utils.equalsAny(command, ['record', 'r']) && parameters.length > 0) {
    try {
      const channel = await somafm.getChannel(parameters[0]);
      record(channel);
      return;
    } catch (error) {
      console.error(error.toString());
      process.exit(10);
    }
  }

  if (utils.equalsAny(command, ['list-favourites', 'list-favorites', 'lf'])) {
    listFavourites(parameters);
    return;
  }

  if (utils.equalsAny(command, ['edit-favourites', 'edit-favorites', 'ef'])) {
    openEditor([favourites.getFavouritesFile()]);
    return;
  }

  cli.showHelp(1);
}

init();
