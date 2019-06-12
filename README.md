User-interface for [fschopp/project-planning-for-you-track](https://github.com/fschopp/project-planning-for-you-track). Allows easy embedding of arbitrary widgets (for instance, a Gantt chart) in order to visualize project schedules created from [YouTrack saved searches](https://www.jetbrains.com/help/youtrack/standalone/Saved-Search.html).

## Status

[![Build Status](https://travis-ci.org/fschopp/project-planning-ui-for-you-track.svg?branch=master)](https://travis-ci.org/fschopp/project-planning-ui-for-you-track)
[![Coverage Status](https://coveralls.io/repos/github/fschopp/project-planning-ui-for-you-track/badge.svg?branch=master)](https://coveralls.io/github/fschopp/project-planning-ui-for-you-track?branch=master)
[![npm](https://img.shields.io/npm/v/@fschopp/project-planning-ui-for-you-track.svg)](https://www.npmjs.com/package/@fschopp/project-planning-ui-for-you-track)

## Overview

- See the [demo](https://fschopp.github.io/project-planning-ui-for-you-track/) for experimenting with the user interface.
- Based on the [S.js](https://github.com/adamhaile/S) reactive programming library and the [Surplus](https://github.com/adamhaile/surplus) compiler and runtime for web views using JSX.
- Written in TypeScript, but easily usable from JavaScript.
- Partial [API documentation](https://fschopp.github.io/project-planning-ui-for-you-track/doc/) available. Generated by TypeDoc.
- Test coverage (for this user-interface library) is currently limited. However, the underlying algorithm packages [fschopp/project-planning-js](https://github.com/fschopp/project-planning-js) and [fschopp/project-planning-for-you-track](https://github.com/fschopp/project-planning-for-you-track) have complete test coverage.

## License

[Apache License 2.0](LICENSE)

## Releases and Usage

Published releases include TypeScript type declarations and are available as either [UMD](https://github.com/umdjs/umd) or ECMAScript 2015 (aka ES6) modules.

### Node.js

Install with `npm install @fschopp/project-planning-ui-for-you-track` or `yarn add @fschopp/project-planning-ui-for-you-track`. See [the demo](https://github.com/fschopp/project-planning-ui-for-you-track/tree/master/src/demo) for a usage example. Note that in a new project, `'../main'` in the import statements would have to be replaced by `'@fschopp/project-planning-ui-for-you-track'`.

### Browser

Include the minified sources from the [jsDelivr CDN](https://www.jsdelivr.com/package/npm/@fschopp/project-planning-ui-for-you-track):
```html
<script src="https://cdn.jsdelivr.net/npm/@fschopp/project-planning-ui-for-you-track@.../dist/index.min.js"
  integrity="..." crossorigin="anonymous"></script>
```
Of course, the two occurrences of `...` need to be replaced by the current version and its corresponding [subresource integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hash.

Note that you also need to add `<script>` elements for all (transitive) dependencies. See [package.json](https://github.com/fschopp/project-planning-ui-for-you-track/tree/master/src/package.json) for the dependency versions. You may also want to check the [Rollup configuration file](https://github.com/fschopp/project-planning-ui-for-you-track/tree/master/src/rollup.config.js) which lists the global symbols this package expects. Currently, the only indirect (that is, purely transitive) dependency is [fschopp/project-planning-js](https://github.com/fschopp/project-planning-js).

## Build

- See the corresponding section in project [fschopp/project-planning-js](https://github.com/fschopp/project-planning-js#build). The description there applies for this project as well.
- This project requires additional machinery to compile [TypeScript .tsx files](https://www.typescriptlang.org/docs/handbook/jsx.html) into plain JavaScript. The compilation happens in two steps: First, the TypeScript compiler produces a .jsx file. Afterwards, the Surplus compiler takes this to produce a plain .js file. Unfortunately, this build chain is not well supported by existing tools (see [Surplus issue #87](https://github.com/adamhaile/surplus/issues/87) for background). This project therefore has its [own Surplus compilation script](https://github.com/fschopp/project-planning-ui-for-you-track/tree/master/src/src/scripts/surplus-compiler.ts). This script also creates proper source maps.
- Parcel is given only pure JavaScript assets, which also means that compilation of the demo has to be manually triggered even when `parcel serve` is currently running.
- For the distribution, [rollup-plugin-postcss](https://github.com/egoist/rollup-plugin-postcss) is used to combine the different css assets into one.
