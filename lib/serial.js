// ---------------------------------------------------------------------------------------------------------------------
// Brief Description of serial.js.
//
// @module serial.js
// ---------------------------------------------------------------------------------------------------------------------

var util = require('util');
var Transform = require('stream').Transform;

// ---------------------------------------------------------------------------------------------------------------------

function ArduinoStream(device)
{
    Transform.call(this);
} // end ArduinoStream

util.inherits(ArduinoStream, Transform);

ArduinoStream.prototype._transform = function(chunk, encoding, done)
{
    console.log(JSON.parse(chunk));
    done();
}; // end _transform

// ---------------------------------------------------------------------------------------------------------------------

module.exports = ArduinoStream;

// ---------------------------------------------------------------------------------------------------------------------