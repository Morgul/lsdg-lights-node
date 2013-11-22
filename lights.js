// ---------------------------------------------------------------------------------------------------------------------
// Main light playing code.
//
// @module lights.js
// ---------------------------------------------------------------------------------------------------------------------

var Player = require('./lib/player');
var Spectrum = require('./lib/spectrum');
var Comm = require('./lib/comm');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

var player = new Player();
//var spectrum = new Spectrum(player);
var comm = new Comm(player);

comm.on('initialized', function()
{
    logger.info('Starting LSDG Lightshow.');
    // Start connecting to the website.
    comm.start();
});

// ---------------------------------------------------------------------------------------------------------------------