#!/usr/bin/env python

#-----------------------------------------------------------------------------------------------------------------------
# Update the json metadata file with per-song thresholds.
#
# Usage:
#   $ ./generateFFT.py ~/music/some_song.mp3
#-----------------------------------------------------------------------------------------------------------------------

import sys
import numpy as np

import audioread

#-----------------------------------------------------------------------------------------------------------------------

# A buffer for the audio, since audioread might not give it to us in the chunks we want
audioBuff = []

# The minimum frequency we want to detect, in Hz.
minFreq = 20

# The number of channels of output
numChannels = 32

#-----------------------------------------------------------------------------------------------------------------------

def calculateLevels(sample, sampleSize, numChannels):

    # Convert raw data to numpy array
    sample = np.frombuffer(''.join(sample), np.int16)

    # Apply FFT - real data so rfft used
    fourier = np.fft.rfft(sample)

    # Remove last element in array to make it the same size as chunk
    fourier = np.delete(fourier, len(fourier) - 1)

    # Find amplitude
    power = np.log10(np.abs(fourier))**2

    #TODO: At this point, I have no idea what to do with the output; I only need 32 channels; how do I take this array, and average the channels out such that I have 32?

    #=================================================
    # Attempting to follow this advice: http://stackoverflow.com/questions/1679974/converting-an-fft-to-a-spectogram#answer-8541731
    normFactor = np.average(power) / numChannels

    out = [x / normFactor for x in power]

    # Now what?
    #=================================================

with audioread.audio_open(sys.argv[1]) as mp3:
    for chunk in mp3:
        audioBuff += chunk

        # Calculate the bytes per sample. (Note, audioread is only ever 16 bit)
        bytesPerSample = mp3.channels * 16

        # FFT is picky about the sample size. This is the correct formula
        sampleSize = ((mp3.samplerate / minFreq) * bytesPerSample)

        # Calculate the levels
        while len(audioBuff) > sampleSize:
            sample = audioBuff[:sampleSize]
            audioBuff = audioBuff[sampleSize:]

            calculateLevels(sample, sampleSize, numChannels)
