#!/usr/bin/env python

#-----------------------------------------------------------------------------------------------------------------------
# Update the json metadata file with per-song thresholds.
#
# Usage:
#   $ ./generateFFT.py ~/music/some_song.mp3
#-----------------------------------------------------------------------------------------------------------------------

import csv
from itertools import chain
import json
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
    def __init__(self, sampleRate, bucketCount, channelName):
        self.bucketCount = bucketCount
        self.channelName = channelName

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
                '{} {} Hz'.format(channelName, 2 ** (freqExponentDelta * (n + .5) + minFreqExponent))
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

        self.amplitudes = [[]] * bucketCount

    def __call__(self, fftOutput):
        lastIdx = 0
        for bucketIdx, freqCount in enumerate(self.freqCounts):
            bucketAmplitude = sum(fftOutput[lastIdx:lastIdx + freqCount]) / freqCount

            self.amplitudes[bucketIdx].append(bucketAmplitude)
            yield bucketAmplitude

            lastIdx += freqCount

        if len(fftOutput) > lastIdx:
            print("\033[93mWARNING:\033[33m {} frequencies left after sorting {} frequencies into {} buckets!\033[m"
                    .format(len(fftOutput) - lastIdx, len(fftOutput), self.bucketCount)
                    )

    def thresholds(self):
        for amplitudes in self.amplitudes:
            amplitudes.sort()

            # Discard the lowest 10th percentile
            del amplitudes[:len(amplitudes) / 10]

            # Average the remaining amplitudes
            #yield sum(amplitudes) / len(amplitudes)

            # Take the median of the remaining amplitudes
            yield amplitudes[len(amplitudes) / 2]


def calculateLevels(chunk, channelBuckets):
    # Convert raw data to numpy array
    chunk = numpy.frombuffer(chunk, numpy.int16)

    # Separate chunks for each channel
    channelChunks = numpy.reshape(chunk, (len(channelBuckets), -1))

    for buckets, channelChunk in zip(channelBuckets, channelChunks):
        # Apply FFT - real data so rfft used
        fourier = numpy.fft.rfft(channelChunk)

        # Remove last element in array to make it the same size as chunk
        fourier = fourier[1:buckets.realFFTOutputs + 1]

        # Find amplitude of each frequency band
        power = 10.0 * numpy.log10(numpy.abs(fourier) ** 2)

        # Average the amplitudes into buckets
        yield buckets(power)


inputFilename = sys.argv[1]
with audioread.audio_open(inputFilename) as audioFile:
    if audioFile.channels == 2:
        channelNames = ['Left', 'Right']
    else:
        channelNames = ['Channel {}'.format(channel) for channel in range(audioFile.channels)]

    channelBuckets = [
            FrequencyBuckets(audioFile.samplerate, freqChannelCount / audioFile.channels, channelName)
            for channelName in channelNames
            ]

    csvFilename = inputFilename[:-4] + '.csv'
    jsonFilename = inputFilename[:-4] + '.json'

    with open(csvFilename, 'wb') as csvFile:
        writer = csv.writer(csvFile)

        writer.writerow(list(chain(*[buckets.names for buckets in channelBuckets])))

        # Calculate the bytes per frame.
        bytesPerFrame = audioFile.channels * bytesPerSample

        bytesPerChunk = channelBuckets[0].samplesPerFFT * bytesPerFrame

        # A buffer for the audio, since audioread might not give it to us in the chunks we want
        audioBuff = ''

        for chunk in audioFile:
            audioBuff += chunk

            # Calculate the levels
            while len(audioBuff) > bytesPerChunk:
                chunk = audioBuff[:bytesPerChunk]
                audioBuff = audioBuff[bytesPerChunk:]

                writer.writerow(list(chain(*calculateLevels(chunk, channelBuckets))))

    with open(jsonFilename, 'r+') as jsonFile:
        metadata = json.load(jsonFile)

        metadata['msPerLine'] = channelBuckets[0].samplesPerFFT / audioFile.samplerate * 1000
        metadata['thresholds'] = list(chain(*[
                buckets.thresholds()
                for buckets in channelBuckets
                ]))

        jsonFile.seek(0)
        json.dump(metadata, jsonFile)

    for buckets in channelBuckets:
        print(buckets.channelName, list(buckets.thresholds()))
