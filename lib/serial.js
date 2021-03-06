// ---------------------------------------------------------------------------------------------------------------------
// Brief Description of serial.js.
//
// @module serial.js
// ---------------------------------------------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var util = require("util");
var events = require("events");

var serial = require('serialport').SerialPort;
var logger = require('omega-logger').loggerFor(module);
var config = require('../config');

// ---------------------------------------------------------------------------------------------------------------------

function Serial(comm)
{
    var self = this;

    // Super call
    events.EventEmitter.call(this);

    // Create and initialize the channelTimes array
    this.channelTimes = [];
    for(var idx = 0; idx < config.get('numChannels', 32); idx++)
    {
        this.channelTimes[idx] = new Date().getTime();
    } // end for

    // Create and initialize the previousLightStates array
    this.previousLightStates = [];
    for(var ydx = 0; ydx < config.get('numChannels', 32); ydx++)
    {
        this.previousLightStates[ydx] = false;
    } // end for

    // Setup our handling of events from comm
    this.comm = comm;
    this.comm.on('playing', this.handlePlaying.bind(this));
    this.comm.on('initialized', function()
    {
        // Setup serial communication
        self.serialComm = new serial(config.get('serialPort', '/dev/ttyACM0'), { baudrate: config.get('serialBaudrate', 115200) });
        self.serialComm.on('open', function()
        {
            self.emit('initialized');
        });
    });
} // end Serial

util.inherits(Serial, events.EventEmitter);

Serial.prototype.clearLights = function()
{
    var resetCommand = '';

    for(var i = 0; i < config.get('numChannels', 32); i++)
    {
        resetCommand += 'p' + i.toString() + 's' + '0';
    } // end for

    this.serialComm.write(resetCommand);
}; // end clearLights

Serial.prototype.handlePlaying = function(song)
{
    var self = this;
    var songStartTime = process.hrtime();

    var csvFile = path.resolve(song.filename.replace('.mp3', '.csv'));
    if(!fs.existsSync(csvFile))
    {
        logger.error('Cannot find csv file for song!');
        return;
    } // end if

    // Clear any lights that might still be on for whatever reason
    this.clearLights();

    var lines = fs.readFileSync(csvFile, { encoding: 'utf8' }).split('\n');

    this.thresholds = song.thresholds || config.defaultThresholds;
    msPerLine = song.msPerLine || 25;

    // Skip the first line of the csv, because it's column headers.
    lines.splice(0, 1);

    var idx = 0;
    function processLine()
    {
        var currentTime;

        self.sendControlString(lines[idx]);

        idx++;

        if(idx < lines.length)
        {
            self.sendControlString(lines[idx]);

            var nextTimeMS = idx * msPerLine;

            currentTime = process.hrtime(songStartTime);
            currentTimeMS = currentTime[0] * 1000 + currentTime[1] / 1000000;

            setTimeout(processLine, Math.floor(nextTimeMS - currentTimeMS));
        }
        else
        {
        //    currentTime = process.hrtime(songStartTime);
        //    currentTimeSec = currentTime[0] + currentTime[1] / 1000000000;
        //    logger.warn('Song ended after %s seconds', currentTimeSec);

            // Clear the last states of the lights, since the song's over.
            self.clearLights();

        } // end if
    } // end processLine

    //logger.info('Song Starting');
    processLine();
}; // end handlePlaying

Serial.prototype.sendControlString = function(line)
{
    var self = this;
    var vals = line.split(',');
    var lightStates = new Array(32);
    var command = '';

    vals.forEach(function(val, idx)
    {
       lightStates[idx] = parseFloat(val) > self.thresholds[idx];
    });

    lightStates.forEach(function(val, idx)
    {
        var timestamp = Date.now();

        if(lightStates[idx] != self.previousLightStates[idx] && (timestamp - self.channelTimes[idx] > 200))
        {
            command += 'p' + idx.toString() + 's' + (val ? '1' : '0');

            self.previousLightStates[idx] = val;
            self.channelTimes[idx] = timestamp;
        } // end if
    });

    if(command)
    {
        command += '\n';
        self.serialComm.write(command);
    } // end if
};

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Serial;

// ---------------------------------------------------------------------------------------------------------------------
