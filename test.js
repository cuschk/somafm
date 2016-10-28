import test from 'ava';
import pify from 'pify';
import execa from 'execa';
import m from './';

const getChannels = pify(m.getChannels);
const getChannel = pify(m.getChannel);

test('fetch channels from API', async t => {
  const channels = await getChannels({forceUpdate: true});
  t.true(channels.length > 0);
});

test('get single channel', async t => {
  const channel = await getChannel('groovesalad');
  t.true(channel.title.length > 0);
});

test('cli list', async t => {
  const process = await execa('./cli.js', ['list']);
  t.is(process.code, 0);
});
