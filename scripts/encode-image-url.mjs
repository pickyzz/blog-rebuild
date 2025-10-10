#!/usr/bin/env node
import { argv } from 'process';
if (!argv[2]) {
  console.error('Usage: node encode-image-url.mjs <url>');
  process.exit(2);
}
const url = argv[2];
const enc = Buffer.from(encodeURIComponent(url), 'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
console.log(enc);
