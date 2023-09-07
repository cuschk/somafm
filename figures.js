'use strict';
const main = {
  play: '▶',
  pause: '▮▮',
  favourite: '❤'
};

const win = Object.assign(main, {
  favourite: '♥'
});

module.exports = process.platform === 'win32' ? win : main;
