'use strict';
const Configstore = require('configstore');
const arrayUnion = require('array-union');
const pkg = require('./package.json');

const conf = new Configstore(pkg.name, {favourites: []});

const utils = {};
let favourites;

const addItem = title => {
  favourites = arrayUnion(favourites, [title]);
};

const removeItem = title => {
  if (utils.isFavourite(title)) {
    const index = favourites.findIndex(x => x === title);
    if (index > -1) {
      favourites.splice(index, 1);
    }
  }
};

const readFavourites = () => {
  favourites = conf.get('favourites');
};

const writeFavourites = () => {
  conf.set('favourites', favourites);
};

utils.isFavourite = title => {
  readFavourites();
  return favourites.findIndex(x => x === title) > -1;
};

utils.addToFavourites = title => {
  readFavourites();
  addItem(title);
  writeFavourites();
};

utils.removeFromFavourites = title => {
  readFavourites();
  removeItem(title);
  writeFavourites();
};

utils.toggleFavourite = title => {
  if (utils.isFavourite(title)) {
    removeItem(title);
  } else {
    addItem(title);
  }

  writeFavourites();
};

module.exports = utils;
