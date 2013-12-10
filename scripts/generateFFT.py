#!/usr/bin/env python

#-----------------------------------------------------------------------------------------------------------------------
# Update the json metadata file with per-song thresholds.
#
# Usage:
#   $ ./generateFFT.py ~/music/some_song.mp3
#-----------------------------------------------------------------------------------------------------------------------

import csv
from itertools import chain
import math
import numpy
import sys

import audioread

#-----------------------------------------------------------------------------------------------------------------------

# The minimum frequency we want to detect, in Hz.
minFreq = 20

# The number of channels of output
freqChannelCount = 32

# audioread is only ever 16 bit == 2 byte
bytesPerSample = 2

#-----------------------------------------------------------------------------------------------------------------------


class FrequencyBuckets(object):
    def __init__(self, sampleRate, bucketCount):
        self.bucketCount = bucketCount

        # In order to be able to distinguish minFreq, we need `sampleRate / minFreq` samples per FFT calculation.
        self.realFFTOutputs = int(math.ceil(sampleRate / (2.0 * minFreq)))
        self.samplesPerFFT = 2 * self.realFFTOutputs

        sampleTime = 1 / float(sampleRate)

        self.maxFreq = sampleRate / 2

        minFreqExponent = math.log(minFreq, 2)
        maxFreqExponent = math.log(self.maxFreq, 2)
        while 2 ** maxFreqExponent < self.maxFreq:
            maxFreqExponent += 0.00000001

        freqExponentDelta = (maxFreqExponent - minFreqExponent) / bucketCount

        self.splitFrequencies = [
                2 ** (freqExponentDelta * n + minFreqExponent)
                for n in range(1, bucketCount + 1)
                ]

        self.names = [
                '{} Hz'.format(2 ** (freqExponentDelta * (n + .5) + minFreqExponent))
                for n in range(1, bucketCount)
                ]

        self.freqCounts = [0] * bucketCount
        for freq in numpy.fft.fftfreq(self.samplesPerFFT, d=sampleTime)[1:self.realFFTOutputs + 1]:
            matched = False
            for bucketNum, splitFreq in enumerate(self.splitFrequencies):
                if math.fabs(freq) < splitFreq:
                    self.freqCounts[bucketNum] += 1
                    matched = True
                    break

            if not matched:
                print("WARNING: Frequency {} didn't match any bucket!".format(freq))

    def __call__(self, fftOutput):
        lastIdx = 0
        for freqCount in self.freqCounts:
            yield sum(fftOutput[lastIdx:lastIdx + freqCount]) / freqCount
            lastIdx += freqCount

        if len(fftOutput) > lastIdx:
            print("\033[93mWARNING:\033[33m {} frequencies left after sorting {} frequencies into {} buckets!\033[m"
                    .format(len(fftOutput) - lastIdx, len(fftOutput), self.bucketCount)
                    )


def calculateLevels(chunk, buckets, channels):
    # Convert raw data to numpy array
    chunk = numpy.frombuffer(chunk, numpy.int16)

    for channelChunk in numpy.reshape(chunk, (channels, -1)):
        # Apply FFT - real data so rfft used
        fourier = numpy.fft.rfft(channelChunk)

        # Remove last element in array to make it the same size as chunk
        fourier = fourier[1:buckets.realFFTOutputs + 1]

        # Find amplitude of each frequency band
        #power = numpy.log10(numpy.abs(fourier)) ** 2
        power = numpy.abs(numpy.log10(fourier)) ** 2

        # Average the amplitudes into buckets
        yield buckets(power)


inputFilename = sys.argv[1]
with audioread.audio_open(inputFilename) as audioFile:
    if audioFile.channels == 2:
        channelNames = ['Left', 'Right']
    else:
        channelNames = ['Channel {}'.format(channel) for channel in range(audioFile.channels)]

    buckets = FrequencyBuckets(audioFile.samplerate, freqChannelCount / audioFile.channels)

    csvFilename = inputFilename + '.csv'

    with open(csvFilename, 'wb') as csvFile:
        writer = csv.writer(csvFile)

        writer.writerow(list(chain(*[
                ['{} {}'.format(channel, name) for name in buckets.names]
                for channel in channelNames
                ])))

        # Calculate the bytes per frame.
        bytesPerFrame = audioFile.channels * bytesPerSample

        bytesPerChunk = buckets.samplesPerFFT * bytesPerFrame

        # A buffer for the audio, since audioread might not give it to us in the chunks we want
        audioBuff = ''

        for chunk in audioFile:
            audioBuff += chunk

            # Calculate the levels
            while len(audioBuff) > bytesPerChunk:
                chunk = audioBuff[:bytesPerChunk]
                audioBuff = audioBuff[bytesPerChunk:]

                writer.writerow(list(chain(*calculateLevels(chunk, buckets, audioFile.channels))))
