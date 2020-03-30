'use strict';
const gulp = require('gulp');
const pkg = require('pkg');
const rename = require('gulp-rename');
const pMap = require('p-map');
const zip = require('gulp-zip');
const vinylPaths = require('vinyl-paths');
const del = require('del');
const p = require('./package.json');

const nodeVersion = '12';

const builds = [
  {src: `${p.name}-linux`, exec: p.name, zip: `${p.name}-${p.version}-linux.zip`},
  {src: `${p.name}-macos`, exec: p.name, zip: `${p.name}-${p.version}-macos.zip`},
  {src: `${p.name}-win.exe`, exec: `${p.name}.exe`, zip: `${p.name}-${p.version}-win.zip`}
];

const createZip = build => {
  return gulp.src(`build/${build.src}`)
    .pipe(vinylPaths(del))
    .pipe(rename(build.exec))
    .pipe(zip(build.zip))
    .pipe(gulp.dest('build'));
};

gulp.task('pkg', () => {
  return pkg.exec(['.', '--out-path=build', `--targets=node${nodeVersion}-linux,node${nodeVersion}-macos,node${nodeVersion}-win`]);
});

gulp.task('zip', ['pkg'], () => {
  return pMap(builds, createZip);
});

gulp.task('clean', () => {
  return del('build');
});

gulp.task('build', ['pkg', 'zip']);
gulp.task('default', ['build']);
