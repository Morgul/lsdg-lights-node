# LSDG Lights

A node.js based version of the code for running the LSDG lightshow. This version doesn't do anything fancy; it reads in meta-data (aka, the mp3 tags) from a `.json` file with the same name as the mp3, as well as a `.csv` file with the pre-calculated FFT output. It then plays the mp3 out of the speakers, and the FFT out of the serial port.

## Configuration

Comes pre-configured with a 'config.js' file. This is basically a little node module that works like a json file, but with comments.

## Installation

Just clone, and run `npm install`. Run it with `npm start`.

## Scripts

There's a python script for building metadata files for music. Unfortunately, node.js doesn't have a working way of reading that information in; all existing attemps are old and broken. Check the script for instructions on running it.
