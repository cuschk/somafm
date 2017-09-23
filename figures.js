'use strict';
const main = {
  play: '▶',
  favourite: '+',
  love: '❤',
  record: '▼'
};

const win = {
  play: '►',
  favourite: '♥',
  love: '♥',
  record: '▼',
};

module.exports = process.platform === 'win32' ? win : main;
