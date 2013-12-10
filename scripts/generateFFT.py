"""Update the json metadata file with per-song thresholds.

"""
from __future__ import print_function
import csv
from itertools import chain
import math
import numpy

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

        self.bucketHistories = [[] for _ in range(bucketCount)]

    def __call__(self, fftOutput):
        lastIdx = 0
        for bucketIdx, freqCount in enumerate(self.freqCounts):
            bucketAmplitude = sum(fftOutput[lastIdx:lastIdx + freqCount]) / freqCount

            self.bucketHistories[bucketIdx].append(bucketAmplitude)
            yield bucketAmplitude

            lastIdx += freqCount

        if len(fftOutput) > lastIdx:
            print("\033[93mWARNING:\033[33m {} frequencies left after sorting {} frequencies into {} buckets!\033[m"
                    .format(len(fftOutput) - lastIdx, len(fftOutput), self.bucketCount)
                    )

    def thresholds(self):
        for history in self.bucketHistories:
            history = list(history)

            history.sort()

            # Discard the lowest 10th percentile
            history = history[len(history) / 10:]

            # Average the remaining history
            #yield sum(history) / len(history)

            # Take the median of the highest 90% of history
            yield history[len(history) / 2]


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


def generateFFT(inputFilename):
    with audioread.audio_open(inputFilename) as audioFile:
        if audioFile.channels == 2:
            # In the case of two channels, we have names for these things
            channelNames = ['Left', 'Right']
        else:
            channelNames = ['Channel {}'.format(channel) for channel in range(audioFile.channels)]

        # Create FrequencyBuckets instances for each audio channel, so we can generate thresholds for each.
        channelBuckets = [
                FrequencyBuckets(audioFile.samplerate, freqChannelCount / audioFile.channels, channelName)
                for channelName in channelNames
                ]

        csvFilename = inputFilename.replace('.mp3', '.csv')

        with open(csvFilename, 'wb') as csvFile:
            writer = csv.writer(csvFile)

            writer.writerow(list(chain(*[buckets.names for buckets in channelBuckets])))

            # Calculate the number of bytes per frame (one sample on each channel) and per chunk (a collection of
            # frames that we run through FFT at the same time)
            bytesPerFrame = audioFile.channels * bytesPerSample

            bytesPerChunk = channelBuckets[0].samplesPerFFT * bytesPerFrame

            # A buffer for the audio, since audioread might not give it to us in the chunks we want
            audioBuff = ''

            for chunk in audioFile:
                audioBuff += chunk

                while len(audioBuff) > bytesPerChunk:
                    # Calculate the levels for the next chunk
                    chunk = audioBuff[:bytesPerChunk]
                    audioBuff = audioBuff[bytesPerChunk:]

                    writer.writerow(list(chain(*calculateLevels(chunk, channelBuckets))))

        return {
                'msPerLine': channelBuckets[0].samplesPerFFT * 1000.0 / audioFile.samplerate,
                'thresholds': list(chain(*[
                    buckets.thresholds()
                    for buckets in channelBuckets
                    ]))
                }
