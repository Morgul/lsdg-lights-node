// ---------------------------------------------------------------------------------------------------------------------
// Main light playing code.
//
// @module lights.js
// ---------------------------------------------------------------------------------------------------------------------

var Player = require('./lib/player');
var Comm = require('./lib/comm');
var Serial = require('./lib/serial');

var config = require('./config');
var package = require('./package');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

var player = new Player();
var comm = new Comm(player, config.get('lightSite', 'http://localhost:8080/rpi'));
var serial = new Serial(comm);

comm.on('initialized', function()
{
    logger.info('Starting LSDG Lightshow, v' + package.version);

    // Start connecting to the website.
    comm.start();
});

// ---------------------------------------------------------------------------------------------------------------------