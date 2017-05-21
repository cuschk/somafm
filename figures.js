'use strict';
const main = {
  play: '▶',
  heart: '❤'
};

const win = {
  play: '►',
  heart: '♥'
};

module.exports = process.platform === 'win32' ? win : main;
