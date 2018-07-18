import test from 'ava';
import execa from 'execa';
import m from '.';

test.serial('fetch channels from API', async t => {
  const channels = await m.getChannels({forceUpdate: true});
  t.true(channels.length > 0);

  const filtered1 = await m.getChannels({search: ['ambient']});
  t.true(filtered1.length > 0);
  t.true(channels.length > filtered1.length);

  const filtered2 = await m.getChannels({search: 'ambient'});
  t.true(filtered2.length > 0);
  t.true(filtered2.length === filtered1.length);
});

test.serial('get single channel', async t => {
  const channel = await m.getChannel('groovesalad');
  t.true(channel.title.length > 0);
  t.true(channel.stream.urls.length > 0);
});

test.serial('cli list', async t => {
  const processList = await execa('./cli.js', ['list']);
  t.is(processList.code, 0);

  const processSearch = await execa('./cli.js', ['list', 'ambient']);
  t.is(processSearch.code, 0);

  t.true(processList.stdout.length > processSearch.stdout.length);
});
