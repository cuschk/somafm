# SomaFM

> List, play, and record SomaFM radio channels.

Show all channels from [SomaFM](http://somafm.com) and play them using [MPlayer](https://mplayerhq.hu).


## tl;dr

You are only one command away from listening to your favourite radio stream.

```
$ somafm play fluid
```


## Install

```
$ npm install --global somafm
```


## Usage

### `somafm list`

List all SomaFM channels.

```
$ somafm list

BAGeL Radio [bagel] What alternative rock radio should sound like.
Beat Blender [beatblender] A late night blend of deep-house and downtempo chill.
Black Rock FM [brfm] From the Playa to the world, back for the 2015 Burning Man festival.
Boot Liquor [bootliquor] Americana Roots music for Cowhands, Cowpokes and Cowtippers
Christmas Lounge [christmas] Chilled holiday grooves and classic winter lounge tracks. (Kid and Parent safe!)
Christmas Rocks! [xmasrocks] Have your self an indie/alternative holiday season!
cliqhop idm [cliqhop] Blips'n'beeps backed mostly w/beats. Intelligent Dance Music.
...
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
    Stream quality   highestpls aac
```

### `somafm play <channel>`

Play a channel. Requires [MPlayer](https://mplayerhq.hu). Please make sure you have it installed and the `mplayer` command can be run within your shell.

```
$ somafm play secretagent

  Playing SomaFM Secret Agent ...

  23:23:14  Dining Rooms - Il Giradischi E I Twoi Dischi (Sowistance Remix)
  23:24:41  Grassy Knoll - Conversations With Julian Dexter
  23:28:23  Tape Five - Longitude 54-21
```

### `somafm record <channel>`

Record a channel. Requires [Streamripper](http://streamripper.sourceforge.net).

```
$ somafm record fluid

  Recording SomaFM Fluid
  to directory SomaFM Fluid/20151210_225323 ...

  22:53:23  Skipping   deeB - Daydream
  22:54:35  Recording  Shlohmo - Rained the Whole Time
  22:59:55  Recording  Koreless - Lost in Tokyo
```

## License

MIT © Christoph Uschkrat
