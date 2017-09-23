'use strict';
const main = {
  play: '▶',
  heart: '❤',
  recording: '▼'
};

const win = {
  play: '►',
  heart: '♥',
  recording: '▼',
};

module.exports = process.platform === 'win32' ? win : main;
