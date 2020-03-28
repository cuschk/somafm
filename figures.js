'use strict';
const main = {
  play: '▶',
  favourite: '❤'
};

const win = Object.assign(main, {
  favourite: '♥'
});

module.exports = process.platform === 'win32' ? win : main;
