# SomaFM [![Build Status](https://travis-ci.org/uschek/somafm.svg?branch=master)](https://travis-ci.org/uschek/somafm)

> Play & record [SomaFM](https://somafm.com) radio channels

![](screenshot.png)


## Install

With [yarn](https://yarnpkg.com):

```console
$ yarn global add somafm
```

or with [npm](https://www.npmjs.com):

```console
$ npm install --global somafm
```


## Usage

### Commands

#### `$ somafm`

Choose a channel to play from the list.

#### `$ somafm list [<keywords>]`

List [SomaFM channels](https://somafm.com/listen/). You can filter by one or more keywords.

#### `$ somafm play <channel>`

Play a channel. Requires [MPlayer](https://mplayerhq.hu) or [mpv](https://mpv.io). Please make sure you have at least one of them installed and the `mplayer` or `mpv` command can be run within your shell.

#### Keyboard shortcuts

Description                          | Key
------------------------------------ | ------------------------------
Copy current song title to clipboard | <kbd>c</kbd>
Add current song to favourites       | <kbd>f</kbd> or <kbd>+</kbd>
Remove current song from favourites  | <kbd>u</kbd> or <kbd>-</kbd>
Increase volume*                     | <kbd>\*</kbd> or <kbd>0</kbd>
Decrease volume*                     | <kbd>/</kbd> or <kbd>9</kbd>
Mute/unmute*                         | <kbd>m</kbd>
Stop playback & quit application     | <kbd>q</kbd> or <kbd>esc</kbd>

<small>_* MPlayer only_</small>

#### `$ somafm info <channel>`

Get channel information.

#### `$ somafm record <channel>`

Record a channel. Requires [Streamripper](http://streamripper.sourceforge.net).

#### `$ somafm list-favourites`

List your favourite songs.

#### `$ somafm edit-favourites`

Edit your favourites songs file.

### Options

#### `-n`

Don't show desktop notifications.

## Command aliases

All commands have short aliases for faster typing.

Command           | Alias
----------------- | -----
`list`            | `ls`
`play`            | `p`
`info`            | `i`
`record`          | `r`
`list-favourites` | `lf`
`edit-favourites` | `ef`


## License

MIT © [Christoph Uschkrat](https://c.uschkrat.com)
