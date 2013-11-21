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

// ---------------------------------------------------------------------------------------------------------------------

function Comm(player)
{
    // Super call
    events.EventEmitter.call(this);

    this.player = player;
    this.playlist =[];

    var self = this;

    this._populatePlaylist(function()
    {
        self.emit('initialized');
    });
} // end Comm

util.inherits(Comm, events.EventEmitter);

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

Comm.prototype.start = function()
{
    //TODO: Connect to the website, or die trying!

    //-------------------------------------------------------------------------------------
    // Assume we can't connect to the website, and play a random song.
    var song = this.playlist[Math.floor(Math.random() * this.playlist.length)];
    this.player.playFile(song);
    //-------------------------------------------------------------------------------------

}; // end Comm

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Comm;

// ---------------------------------------------------------------------------------------------------------------------