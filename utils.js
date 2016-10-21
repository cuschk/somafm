'use strict';
const Conf = require('conf');
const arrayUnion = require('array-union');

const favouritesConf = new Conf({configName: 'favourites'});

const utils = {};
let favourites;

const addFavouriteItem = title => {
  favourites = arrayUnion(favourites, [title]);
};

const removeFavouriteItem = title => {
  if (utils.isFavourite(title)) {
    const index = favourites.findIndex(x => x === title);
    if (index > -1) {
      favourites.splice(index, 1);
    }
  }
};

const readFavourites = () => {
  favourites = favouritesConf.get('favourites') || [];
};

const writeFavourites = () => {
  favouritesConf.set('favourites', favourites);
};

utils.isFavourite = title => {
  readFavourites();
  return favourites.findIndex(x => x === title) > -1;
};

utils.addToFavourites = title => {
  readFavourites();
  addFavouriteItem(title);
  writeFavourites();
};

utils.removeFromFavourites = title => {
  readFavourites();
  removeFavouriteItem(title);
  writeFavourites();
};

utils.getFavourites = cb => {
  readFavourites();

  return cb(favourites);
};

utils.getFavouritesFile = () => {
  return favouritesConf.path;
};

module.exports = utils;
