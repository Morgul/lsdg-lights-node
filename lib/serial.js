// ---------------------------------------------------------------------------------------------------------------------
// Brief Description of serial.js.
//
// @module serial.js
// ---------------------------------------------------------------------------------------------------------------------

var fs = require('fs');

var serial = require('serialport').SerialPort;
var logger = require('omega-logger').loggerFor(module);
var config = require('../config');

// ---------------------------------------------------------------------------------------------------------------------

function Serial(comm)
{
    this.comm = comm;
    this.comm.on('playing', this.handlePlaying.bind(this));

    this.serialComm = new serial(config.serialPort, { baudrate: config.serialBaudrate });
    this.serialComm.on('open', function()
    {
        logger.info('Serial port open');
    });

    this.channelTimes = [];
    for(var i = 0; i < config.get('numChannels', 32); i++)
    {
        this.channelTimes[i] = new Date().getTime();
    }

    this.previousLightStates = [];
    for(var i = 0; i < config.get('numChannels', 32); i++)
    {
        this.previousLightStates[i] = false;
    }

} // end Serial

Serial.prototype.handlePlaying = function(song)
{
    var self = this;
    logger.info('Got new song:', song);

    this.thresholds = song.thresholds || config.defaultThresholds;

    var lines = fs.readFileSync(song.filename.replace('.mp3', '.csv'), { encoding: 'utf8' }).split('\n');

    logger.info('Song Starting');
    this.sendControlString(lines[0]);

    var i = 1;
    var timerID = setInterval(function()
    {
        i++;
        if(i < lines.length)
        {
            self.sendControlString(lines[i]);
        }
        else
        {
            logger.warn('Song Ended');
            clearInterval(timerID);
        }
    }, 25);
}; // end handlePlaying

Serial.prototype.sendControlString = function(line)
{
    var self = this;
    var lightStates = new Array(32);
    var vals = line.split(',');
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
        }
    });

    if(command)
    {
        command += '\n';
        self.serialComm.write(command);
    }
};

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Serial;

// ---------------------------------------------------------------------------------------------------------------------