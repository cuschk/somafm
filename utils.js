'use strict';

const equalsAny = (search, arr) => {
  return arr.indexOf(search) > -1;
};

const isSubstringOfAny = (search, arr) => {
  return arr.some(str => str.toLowerCase().includes(search));
};

const searchArrayMatchesAny = (search, items) => {
  for (const searchItem of search) {
    if (!isSubstringOfAny(searchItem.toLowerCase(), items)) {
      return false;
    }
  }

  return true;
};

module.exports = {
  equalsAny,
  isSubstringOfAny,
  searchArrayMatchesAny
};
