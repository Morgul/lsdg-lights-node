// ---------------------------------------------------------------------------------------------------------------------
// Handles communication with the website. Also is the brains of the operation; if it fails to connect to the website,
// it plays a random song.
//
// @module comm.js
// ---------------------------------------------------------------------------------------------------------------------

var util = require("util");
var events = require("events");
var path = require('path');

var walk = require('walk');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

function Comm(player)
{
    var self = this;

    // Super call
    events.EventEmitter.call(this);

    this.connected = false;
    this.player = player;
    this.playlist =[];

    // Connect up our handlers
    this._connectHandlers();

    // Populate the playlist
    this._populatePlaylist(function()
    {
        self.emit('initialized');
    });
} // end Comm

util.inherits(Comm, events.EventEmitter);

//----------------------------------------------------------------------------------------------------------------------
// Helpers
//----------------------------------------------------------------------------------------------------------------------

Comm.prototype._connectHandlers = function()
{
    this.player.on('stopped', this.handleSongEnd.bind(this));
};

Comm.prototype._populatePlaylist = function(done)
{
    done = done || function(){};
    var self = this;

    // Walker options
    var walker = walk.walk('./music', { followLinks: true });

    walker.on('file', function(root, stat, next) {
        if(path.extname(stat.name) == '.mp3')
        {
            self.playlist.push(path.join(root, stat.name));
        } // end if
        next();
    });

    walker.on('end', function() {
        done();
    });
};

Comm.prototype._playRandomSong = function()
{
    var song = this.playlist[Math.floor(Math.random() * this.playlist.length)];

    logger.info('Playing random song:', song);

    this.player.playFile(song);
};

//----------------------------------------------------------------------------------------------------------------------
// Event Handlers
//----------------------------------------------------------------------------------------------------------------------

Comm.prototype.handleSongEnd = function()
{
    if(!this.connected)
    {
        this._playRandomSong();
    } // end if
};

//----------------------------------------------------------------------------------------------------------------------
// API
//----------------------------------------------------------------------------------------------------------------------

Comm.prototype.start = function()
{
    logger.info('Attempting to connect to the website...');

    //TODO: Connect to the website, or die trying!

    //-------------------------------------------------------------------------------------
    // Assume we can't connect to the website, and play a random song.

    logger.warn('Failed to connect to the website: Not Implemented Yet!');
    this._playRandomSong();

    //-------------------------------------------------------------------------------------

}; // end Comm

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Comm;

// ---------------------------------------------------------------------------------------------------------------------