# SomaFM

> Play & record SomaFM radio channels.

Show all channels from [SomaFM](http://somafm.com) and play them using [MPlayer](https://mplayerhq.hu).


## tl;dr

You are only one command away from listening to your favourite radio stream.

![Screenshot](screenshot.png)


## Install

```
$ npm install --global somafm
```


## Usage

### `somafm list`

List all SomaFM channels.

```
$ somafm list

BAGeL Radio [bagel] (alternative/rock) - What alternative rock radio should…
Beat Blender [beatblender] (electronica) - A late night blend of deep-house…
Black Rock FM [brfm] (eclectic) - From the Playa to the world, back for the…
Boot Liquor [bootliquor] (americana) - Americana Roots music for Cowhands, …
cliqhop idm [cliqhop] (electronica) - Blips'n'beeps backed mostly w/beats. …
…
```

### `somafm info <channel>`

Get channel information.

```
$ somafm info groovesalad

  SomaFM Groove Salad [groovesalad]

  A nicely chilled plate of ambient/downtempo beats and grooves.

    Now playing   Eat Static - The Wreckage

             DJ   Rusty Hodge
          Genre   ambient|electronica
      Listeners   2895

     Stream URL   http://somafm.com/groovesalad130.pls
```

### `somafm play <channel>`

Play a channel. Requires [MPlayer](https://mplayerhq.hu). Please make sure you have it installed and the `mplayer` command can be run within your shell.

```
$ somafm play secretagent

  Playing SomaFM Secret Agent

  23:23:14  Dining Rooms - Il Giradischi E I Twoi Dischi (Sowistance Remix)
  23:24:41  Grassy Knoll - Conversations With Julian Dexter
  23:28:23  Tape Five - Longitude 54-21
```

*Bonus: You can copy the currently playing song title to the clipboard by hitting <kbd>c</kbd>.*

### `somafm record <channel>`

Record a channel. Requires [Streamripper](http://streamripper.sourceforge.net).

```
$ somafm record fluid

  Recording SomaFM Fluid
  to directory SomaFM Fluid/20151210_225323

  22:53:23  Skipping   deeB - Daydream
  22:54:35  Recording  Shlohmo - Rained the Whole Time
  22:59:55  Recording  Koreless - Lost in Tokyo
```

## License

MIT © [Christoph Uschkrat](https://c.uschkrat.com)
