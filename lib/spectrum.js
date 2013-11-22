// ---------------------------------------------------------------------------------------------------------------------
// Performs fft calculation on the audio data received by the player, and calls into the serial code to switch the
// lights.
//
// @module spectrum.js
// ---------------------------------------------------------------------------------------------------------------------

var util = require('util');
var Transform = require('stream').Transform;

var FFT = require('fft');

var ArduinoStream = require('./serial');

// ---------------------------------------------------------------------------------------------------------------------

function FFTStream(numOutChannels)
{
    Transform.call(this);
    this.numOutChannels = numOutChannels;
    this.buffer = [];
    this.threshold = 0.145;
} // end FFTStream

util.inherits(FFTStream, Transform);

FFTStream.prototype._convertToFloat = function(samples)
{
    var bitsPerSample = 16;
    var out = [];
    for(var idx = 0; idx < samples.length; idx++)
    {
        out.push(samples[idx] / Math.pow(2,bitsPerSample));
    } // end for

    return out;
}; // end _convertToFloat

FFTStream.prototype._processAudioData = function(samples)
{
    var self = this;
    var outBins = [];

    //------------------------------------------------------------------------------------------------------------------
    // Liberally taken from: https://github.com/richardeoin/nodejs-simple-fft
    //------------------------------------------------------------------------------------------------------------------

    function round_to_6dp(val) {
        return Math.round(val*1000000)/1000000;
    }

    var data_len = samples.length;

    /* Check we have a suitable number of data_len */
    if (data_len < 1) { throw new Error("Array to fast fourier transform must have 1 or more datapoints."); }

    /* Prepare an output buffer for the fft */
    var fft_output = new Array(data_len);

    /* Do the FFT */
    var fft = new FFT.complex(data_len, false);
    fft.simple(fft_output, samples, 'real');

    /* Process the fft output */
    for (i = 0; i < (data_len/2)+1; i++) { /* We only get back half the number of bins as we do samples */
        var real = fft_output[(i*2)+0]; /* Even indexes are the real values */
        var imag = fft_output[(i*2)+1]; /* Odd indexes are the imaginary values */
        fft_output[i] = round_to_6dp(Math.sqrt((real*real)+(imag*imag)));
    }

    /* Return the output of the FFT, only returning as many bins as we have */
    outBins = fft_output.slice(0, (data_len/2)+1);

    //------------------------------------------------------------------------------------------------------------------

    var outChannels = [];
    var samplesPerBucket = Math.floor(outBins.length / this.numOutChannels);

    for(var idx = 0; idx < outBins.length; idx += samplesPerBucket)
    {
        var sum = 0;

        for(var ydx = 0; ydx <= samplesPerBucket; ydx++)
        {
            sum += outBins[idx + ydx];
        } // end for

        outChannels.push(sum / samplesPerBucket);
    } // end for

    outChannels.forEach(function(val, index)
    {
        outChannels[index] = val > self.threshold;
    });

    this.push(JSON.stringify(outChannels));

}; // end

FFTStream.prototype._transform = function(chunk, encoding, done)
{
    this.buffer = this.buffer.concat(this._convertToFloat(chunk));
    var sampleSize = 22000;

    while(this.buffer.length > sampleSize)
    {
        this._processAudioData(this.buffer.splice(0, sampleSize));
    } // end if

    done();
}; // end _transform

// ---------------------------------------------------------------------------------------------------------------------

function Spectrum(player)
{
    this.player = player;
    this.player.on('playing', this.handlePlaying.bind(this));
} // end Spectrum

Spectrum.prototype.handlePlaying = function(filename)
{
    var sampleRate = this.player.currentFormat.sampleRate;

    var fftStream = new FFTStream(32);
    this.player.currentStream.pipe(fftStream);

    fftStream.pipe(new ArduinoStream());
}; // end handlePlaying

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Spectrum;

// ---------------------------------------------------------------------------------------------------------------------