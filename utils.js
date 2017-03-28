'use strict';
const Conf = require('conf');
const arrayUnion = require('array-union');

const favouritesConf = new Conf({configName: 'favourites'});
const settingsConf = new Conf({configName: 'settings'});

const utils = {};
let favourites;

function addFavouriteItem(title) {
  favourites = arrayUnion(favourites, [title]);
}

function removeFavouriteItem(title) {
  if (isFavourite(title)) {
    const index = favourites.findIndex(x => x === title);
    if (index > -1) {
      favourites.splice(index, 1);
    }
  }
}

function readFavourites() {
  favourites = favouritesConf.get('favourites') || [];
}

function writeFavourites() {
  favouritesConf.set('favourites', favourites);
}

function isFavourite(title) {
  readFavourites();
  return favourites.findIndex(x => x === title) > -1;
}

function addToFavourites(title) {
  readFavourites();
  addFavouriteItem(title);
  writeFavourites();
}

function removeFromFavourites(title) {
  readFavourites();
  removeFavouriteItem(title);
  writeFavourites();
}

function getFavourites(cb) {
  readFavourites();

  return cb(favourites);
}

function getFavouritesFile() {
  return favouritesConf.path;
}

function setLastChannel(channel) {
  settingsConf.set('lastChannel', channel);
}

function getLastChannel() {
  return settingsConf.get('lastChannel');
}

utils.isFavourite = isFavourite;
utils.addToFavourites = addToFavourites;
utils.removeFromFavourites = removeFromFavourites;
utils.getFavourites = getFavourites;
utils.getFavouritesFile = getFavouritesFile;
utils.setLastChannel = setLastChannel;
utils.getLastChannel = getLastChannel;

module.exports = utils;
