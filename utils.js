'use strict';
const levenshtein = require('fast-levenshtein').get;

/**
 * Check if string equals any string in an array
 * @param  {String} search String to search for
 * @param  {Array<String>} arr Array of strings to search in
 * @return {Boolean} true/false
 */
const equalsAny = (search, arr) => {
  return arr.indexOf(search) > -1;
};

/**
 * Check if a string is a substring of another string
 * @param  {String} search String to search for
 * @param  {String} str String to search in
 * @return {Boolean} true/false
 */
const isSubstringOf = (search, str) => str.toLowerCase().includes(search);

/**
 * Check if two strings match fuzzily
 * @param  {String} search  First string
 * @param  {String} str     Second string
 * @return {Boolean}        `true`, if strings matchs fuzzily, `false` otherwise
 */
const fuzzyMatch = (search, str) => levenshtein(search, str) < 3;

/**
 * Check if string is substring of or fuzzy-matches any string in an array
 * @param  {String} search      String to search for
 * @param  {Array<String>} arr  Array to search in
 * @return {Boolean}            `true`, if `search` is found in `arr`, `false` otherwise
 */
const isSubstringOfAny = (search, arr) =>
  arr.some(str => isSubstringOf(search, str) || fuzzyMatch(str.toLowerCase(), search));

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
