'use strict';
const Conf = require('conf');

const favouritesConf = new Conf({configName: 'favourites'});

let favourites;

const readFavourites = () => {
  favourites = favouritesConf.get('favourites', []);
};

const writeFavourites = () => {
  favouritesConf.set('favourites', favourites);
};

const getFavourites = () => {
  readFavourites();
  return Promise.resolve().then(() => favourites);
};

const getFavouritesFile = () => {
  return favouritesConf.path;
};

const favFindFn = title => x => x === title || x.title === title;

const getFavouriteItemIndexByTitle = title => favourites.findIndex(favFindFn(title));

const isFavourite = title => {
  readFavourites();
  return getFavouriteItemIndexByTitle(title) > -1;
};

const addFavouriteItem = (item, timestamp) => {
  timestamp = timestamp || Date.now();

  if (!isFavourite(item)) {
    favourites.push({
      title: item.title,
      channelTitle: item.channel.fullTitle,
      channelId: item.channel.id,
      timestamp
    });
  }
};

const removeFavouriteItem = title => {
  if (isFavourite(title)) {
    const index = getFavouriteItemIndexByTitle(title);
    if (index > -1) {
      favourites.splice(index, 1);
    }
  }
};

const addToFavourites = (item, timestamp) => {
  readFavourites();
  addFavouriteItem(item, timestamp);
  writeFavourites();
};

const removeFromFavourites = title => {
  readFavourites();
  removeFavouriteItem(title);
  writeFavourites();
};

module.exports = {
  addToFavourites,
  removeFromFavourites,
  isFavourite,
  getFavourites,
  getFavouritesFile
};
