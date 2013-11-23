// ---------------------------------------------------------------------------------------------------------------------
// Reads the specified mp3, and plays it. It exposed both events for when songs start and finish playing, as well as
// making the currently playing stream available to whomever wants it.
//
// @module player.js
// ---------------------------------------------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var util = require("util");
var events = require("events");

var lame = require('lame');
var Speaker = require('speaker');

var logger = require('omega-logger').loggerFor(module);

// ---------------------------------------------------------------------------------------------------------------------

function Player()
{
    // Super call
    events.EventEmitter.call(this);

    this.currentFormat = null;
    this._currentFile = null;

    // Define a property that always returns just the basename of the file we're playing.
    Object.defineProperty(this, 'currentFile', {
        get: function()
        {
            return path.basename(this._currentFile);
        },
        set: function(value)
        {
            this._currentFile = value;
        }
    });

    // Define a property to easily check if we're playing a song.
    Object.defineProperty(this, 'playing', {
        get: function()
        {
            return this._currentFile ? true : false;
        }
    });
} // end Player

util.inherits(Player, events.EventEmitter);

Player.prototype._handleStop = function()
{
    this.emit('stopped', this.currentFile);
    this.currentFile = null;
    this.currentStream = null;
    this.currentFormat = null;
};

Player.prototype.playFile = function(filename)
{
    if(!filename)
    {
        return;
    } // end if

    var self = this;
    filename = path.resolve(filename);
    this.currentFile = filename;

    // Setup the current stream
    this.currentStream = fs.createReadStream(filename);

    // Actually build up the stream, and all the fiddly bits that want to work with it.
    this.currentStream
        .pipe(new lame.Decoder({ float: true }))
        .on('format', function(format)
        {
            self.currentFormat = format;

            // Let people know the format of the current file.
            self.emit('format', format);

            // Pipe the output to Speaker
            this.pipe(new Speaker(format));

            // Aaaand, now we're playing.
            self.emit('playing', self.currentFile);
        })
        .on('end', this._handleStop.bind(this))
        .on('close', this._handleStop.bind(this));
}; // end playFile

Player.prototype.stop = function()
{
    if(this.currentStream)
    {
        this.currentStream.close();

        // Declare the playing stopped
        this._handleStop();
    } // end if
}; // end stop

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Player;

// ---------------------------------------------------------------------------------------------------------------------