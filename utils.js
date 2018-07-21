'use strict';

const equalsAny = (search, arr) => {
  return arr.indexOf(search) > -1;
};

const isSubstringOfAny = (search, arr) => {
  return arr.some(str => str.toLowerCase().includes(search));
};

module.exports = {
  equalsAny,
  isSubstringOfAny
};
