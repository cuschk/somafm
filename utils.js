'use strict';
const levenshtein = require('fast-levenshtein').get;

const equalsAny = (search, arr) => {
  return arr.indexOf(search) > -1;
};

const fuzzyMatch = (search, str) => levenshtein(search, str) < 3;

const isSubstringOfAny = (search, arr) => {
  return arr.some(str => str.toLowerCase().includes(search) || fuzzyMatch(str.toLowerCase(), search));
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
  fuzzyMatch,
  isSubstringOfAny,
  searchArrayMatchesAny
};
