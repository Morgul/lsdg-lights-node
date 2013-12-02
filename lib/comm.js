// ---------------------------------------------------------------------------------------------------------------------
// Handles communication with the website. Also is the brains of the operation; if it fails to connect to the website,
// it plays a random song.
//
// @module comm.js
// ---------------------------------------------------------------------------------------------------------------------

var fs = require("fs");
var path = require('path');
var util = require("util");
var events = require("events");

var walk = require('walk');
var io = require('socket.io-client');

var config = require('../config');

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
        self.emit('stopped');
    });

    this.socket.on('stop immediately', function(cb)
    {
        self.player.stop();
        self.emit('stopped');
    });
};

Comm.prototype._getIndexOfSong = function(filename)
{
    for(var idx = 0; idx < this.playlist.length; idx++)
    {
        if(this.playlist[idx].filename == filename)
        {
            return idx;
        } // end if
    } // end for

    return -1;
}; // end _getIndexOfSong

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
    var walker = walk.walk(config.get('musicDir', './music'), { followLinks: config.get('followSymlinks', true) });

    walker.on('file', function(root, stat, next) {
        if(path.extname(stat.name) == '.mp3')
        {
            var metadataFile = stat.name.replace('.mp3', '.json');

            fs.exists(path.join(root, metadataFile), function(exists)
            {
                if(exists)
                {
                    var metadata = require(path.resolve(path.join(root, metadataFile)));

                    self.playlist.push({
                        title: metadata.title,
                        artist: metadata.artist,
                        duration: metadata.duration,
                        thresholds: metadata.thresholds,
                        filename: path.join(root, stat.name)
                    });
                } // end if
                next();
            });
        }
        else
        {
            next();
        } // end if
    });

    walker.on('end', function() {
        done();
    });
};

Comm.prototype._playRandomSong = function()
{
    if(this.playlist.length == 0)
    {
        logger.error('Playlist is empty. Please check your configuration.');
        process.kill();
    }
    else
    {
        var song = this.playlist[Math.floor(Math.random() * this.playlist.length)];

        logger.info('Playing random song:', song.filename);

        // Emit the playing event, with the index into the playlist
        this.emit('playing', song);

        this.player.playFile(song.filename);
    } // end if
};

Comm.prototype._playNextSong = function()
{
    if(this.playlist.length == 0)
    {
        logger.error('Playlist is empty. Please check your configuration.');
        process.kill();
    }
    else
    {
        logger.info('Playing song:', this.nextSong);

        var song = this.playlist[this._getIndexOfSong(this.nextSong)];

        // Emit the playing event, with the index into the playlist
        this.emit('playing', song);

        this.player.playFile(this.nextSong);
        this.nextSongCB({confirm: true});

        // Clear out our next song
        this.nextSong = undefined;
        this.nextSongCB = undefined;
    } // end if
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