// ---------------------------------------------------------------------------------------------------------------------
// Main light playing code.
//
// @module lights.js
// ---------------------------------------------------------------------------------------------------------------------

var Player = require('./lib/player');
var Comm = require('./lib/comm');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

var player = new Player();
var comm = new Comm(player, 'http://lights.lsdg.org:8080/rpi');

comm.on('initialized', function()
{
    logger.info('Starting LSDG Lightshow.');

    // Start connecting to the website.
    comm.start();
});

// ---------------------------------------------------------------------------------------------------------------------