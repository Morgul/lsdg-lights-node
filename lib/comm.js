// ---------------------------------------------------------------------------------------------------------------------
// Handles communication with the website. Also is the brains of the operation; if it fails to connect to the website,
// it plays a random song.
//
// @module comm.js
// ---------------------------------------------------------------------------------------------------------------------

var util = require("util");
var events = require("events");
var fs = require("fs");
var path = require('path');

var walk = require('walk');
var io = require('socket.io-client');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

function Comm(player, website)
{
    var self = this;

    // Super call
    events.EventEmitter.call(this);

    this.connected = false;
    this.website = website;
    this.socket = null;
    this.player = player;
    this.playlist =[];

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
    var self = this;

    // Player event handlers
    this.player.on('stopped', this.handleSongEnd.bind(this));

    // Socket.io event handlers
    this.socket.on('error', this.handleSocketError.bind(this));
    this.socket.on('connect', this.handleSocketConnect.bind(this));
    this.socket.on('disconnect', this.handleSocketDisconnect.bind(this));

    this.socket.on('get status', function(cb)
    {
        cb({ playing: self.player.currentFile || "none" });
    });

    this.socket.on('list songs', function(cb)
    {
        cb(self.playlist);
    });

    this.socket.on('play next', function(data, cb)
    {
        if(!data.song)
        {
            logger.warn('Missing \'song\' parameter. Ignoring.');
            return;
        } // end if

        self.nextSong = data.song;
        self.nextSongCB = cb;

        if(!self.player.playing)
        {
            self._playNextSong();
        } // end if
    });

    this.socket.on('stop', function(cb)
    {
        //TODO: implement 'stop after current song' functionality.
        self.player.stop();
    });

    this.socket.on('stop immediately', function(cb)
    {
        self.player.stop();
    });
};

Comm.prototype._play = function()
{
    if(!this.connected)
    {
        this._playRandomSong();
    }
    else
    {
        if(this.nextSong)
        {
            this._playNextSong();
        } // end if
    } // end if
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
            var name = path.basename(stat.name);

            var title = (name.split(' - ')[1] || "???");
            var artist = (name.split(' - ')[0] || "???");

            self.playlist.push({
                title: title,
                artist: artist,
                duration: 200,
                filename: path.join(root, stat.name)
            });
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

    logger.info('Playing random song:', song.filename);

    this.player.playFile(song.filename);
};

Comm.prototype._playNextSong = function()
{
    logger.info('Playing song:', this.nextSong);

    this.player.playFile(this.nextSong);
    this.nextSongCB({confirm: true});

    // Clear out our next song
    this.nextSong = undefined;
    this.nextSongCB = undefined;
};

//----------------------------------------------------------------------------------------------------------------------
// Event Handlers
//----------------------------------------------------------------------------------------------------------------------

Comm.prototype.handleSongEnd = function(song)
{
    this.socket.emit('song finished', { song: song });

    // Play the song
    this._play();
};

Comm.prototype.handleSocketError = function(error)
{
    logger.error('Socket.io error:', error);
}; // end handleSocketError

Comm.prototype.handleSocketConnect = function()
{
    logger.info('Website connected!');
    this.connected = true;

    // Handle the case we're not playing music yet.
    if(!this.player.playing)
    {
        // This will kickstart our song playing extravaganza.
        this._play();
    } // end if
}; // end handleSocketConnect

Comm.prototype.handleSocketDisconnect = function()
{
    logger.warn('Website disconnected!');
    this.connected = false;

    // Handle the case we're not playing music yet.
    if(!this.player.playing)
    {
        // This will kickstart our song playing extravaganza.
        this._play();
    } // end if
}; // end handleSocketDisconnect

//----------------------------------------------------------------------------------------------------------------------
// API
//----------------------------------------------------------------------------------------------------------------------

Comm.prototype.start = function()
{
    var self = this;
    logger.info('Attempting to connect to the website:', this.website);

    // Connect to the website, or die trying!
    this.socket = io.connect(this.website);

    // Connect up our handlers
    this._connectHandlers();

    setTimeout(function()
    {
        if(!self.player.playing)
        {
            // This will kickstart our song playing extravaganza.
            self._play();
        } // end if
    }, 5000);
}; // end Comm

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Comm;

// ---------------------------------------------------------------------------------------------------------------------