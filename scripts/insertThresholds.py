#!/usr/bin/env python

#-----------------------------------------------------------------------------------------------------------------------
# Update the json metadata file with per-song thresholds.
#
# Note: If you're not Chris, Dave, Travis or Jonathan, you probably don't need to run this!
#
# Usage:
#   $ ./insertThresholds.py ~/music ~/Downloads/Thresholds
#-----------------------------------------------------------------------------------------------------------------------

import sys
import os
import json
import fnmatch

#-----------------------------------------------------------------------------------------------------------------------

thresholdsDir = sys.argv[2]

for root, dir, files in os.walk(sys.argv[1]):
    for item in fnmatch.filter(files, "*.json"):
        filePath = os.path.join(root, item)

        filename = os.path.basename(filePath)
        thresholdPath = os.path.join(thresholdsDir, filename.replace('.json', ''))

        if os.path.exists(thresholdPath):

            with open(thresholdPath, 'r') as thresholdFile:
                thresholds = [float(line) for line in thresholdFile]

                with open(filePath, 'r+') as metaFile:
                    metadata = json.load(metaFile)
                    metadata['thresholds'] = thresholds

                    metaFile.seek(0)
                    json.dump(metadata, metaFile)

#-----------------------------------------------------------------------------------------------------------------------

