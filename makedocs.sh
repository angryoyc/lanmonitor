#!/bin/sh

rm -fr ./help/*
./node_modules/.bin/jsdoc  --readme ./README.md --destination ./help/ --verbose lanmonitor.js
