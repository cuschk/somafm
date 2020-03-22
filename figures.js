'use strict';
const main = {
  play: '▶',
  heart: '❤'
};

const win = Object.assign(main, {
  heart: '♥'
});

module.exports = process.platform === 'win32' ? win : main;
