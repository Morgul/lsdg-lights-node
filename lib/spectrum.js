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

function FFTStream(format, numOutChannels)
{
    Transform.call(this);
    this.numOutChannels = numOutChannels;
    this.buffer = [];
    this.threshold = 0.28;

    // Format
    this.format = format;
    this.bytesPerSample = format.channels * format.bitDepth;

    // Lowest frequency we want to sample is 20hz
    this.minFreq = 20;
} // end FFTStream

util.inherits(FFTStream, Transform);

FFTStream.prototype._convertToFloat = function(samples)
{
    var out = [];
    for(var idx = 0; idx < samples.length; idx++)
    {
        out.push(samples[idx] / Math.pow(2, this.format.bitDepth));
    } // end for

    return out;
}; // end _convertToFloat

FFTStream.prototype._processAudioData = function(samples)
{
    console.log(new Date().getTime(), ' :: processing audio!');

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

    // Change the output to a logarithmic scale
    for(var idx=0; idx < self.numOutChannels; idx++)
    {
        var binsIdx = Math.pow(2, idx);
        var numSamples = Math.pow(2, idx + 1);
        var samples = outBins.slice(binsIdx, numSamples);

        if(samples.length)
        {
            var sum = 0;
            for(var num=0; num < samples.length; num++)
            {
                sum += samples[num];
            } // end for
            sum = sum / samples.length;

            outChannels.push(sum);
        } // end if
    } // end if

    outChannels.forEach(function(val, index)
    {
        outChannels[index] = val > self.threshold;
    });

    this.push(JSON.stringify(outChannels));

}; // end

FFTStream.prototype._transform = function(chunk, encoding, done)
{
    var self = this;
    this.buffer = this.buffer.concat(this._convertToFloat(chunk));

    // Calculate the sample size we need to send to FFT
    var sampleSize = ((this.format.sampleRate / this.minFreq) * this.bytesPerSample);

    function processAudio()
    {
        if(self.buffer.length > sampleSize)
        {
            setTimeout(function()
            {
                console.log('looping!')
                self._processAudioData(self.buffer.splice(0, sampleSize));
            }, 1/20);
        } // end if
    }

    setTimeout(function()
    {
        processAudio();
    }, 1/20);

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
    var fftStream = new FFTStream(this.player.currentFormat, 32);
    this.player.currentStream.pipe(fftStream);

    fftStream.pipe(new ArduinoStream());
}; // end handlePlaying

// ---------------------------------------------------------------------------------------------------------------------

module.exports = Spectrum;

// ---------------------------------------------------------------------------------------------------------------------