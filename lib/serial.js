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

Serial.prototype.handlePlaying = function(song)
{
    var self = this;
    var csvFile = path.resolve(song.filename.replace('.mp3', '.csv'));
    if(!fs.existsSync(csvFile))
    {
        logger.error('Cannot find csv file for song!')
        return;
    } // end if

    var lines = fs.readFileSync(csvFile, { encoding: 'utf8' }).split('\n');

    this.thresholds = song.thresholds || config.defaultThresholds;
    //logger.info('Song Starting');
    this.sendControlString(lines[0]);

    var idx = 1;
    var timerID = setInterval(function()
    {
        idx++;
        if(idx < lines.length)
        {
            self.sendControlString(lines[idx]);
        }
        else
        {
            //logger.warn('Song Ended');
            clearInterval(timerID);
        } // end if
    }, 25);
}; // end handlePlaying

Serial.prototype.sendControlString = function(line)
{
    var self = this;
    var vals = line.split(',');
    var lightStates = new Array(32);
    var command = '';

    vals.forEach(function(val, idx)
    {
       lightStates[idx] = val > self.thresholds[idx];
    });

    lightStates.forEach(function(val, idx)
    {
        if(vals[idx] != self.previousLightStates[idx] && (new Date().getTime() - self.channelTimes[idx] > 200))
        {
            command += 'p' + idx.toString() + 's' + (val ? '1' : '0');
            self.previousLightStates[idx] = val;
            self.channelTimes[idx] = new Date().getTime();
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