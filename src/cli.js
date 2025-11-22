#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(`
	Usage
	  $ gitfetch

	Options
	  --name   Your name
	     --mock   Use mock data for testing
	     --local  Fetch stats from local git repository

	Examples
	  $ gitfetch
	     $ gitfetch --mock
	     $ gitfetch --local
`, {
  importMeta: import.meta,
  flags: {
    mock: {
      type: 'boolean'
    },
    local: {
      type: 'boolean'
    }
  }
});

// Clear screen before initial render to help with cleanliness
console.clear();
render(<App flags={cli.flags} />);
