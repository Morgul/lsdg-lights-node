#!/usr/bin/env python

#-----------------------------------------------------------------------------------------------------------------------
# Build a metadata json file for all mp3 files in the specified path.
#
# Usage:
#   $ ./buildMetadata.py ~/music
#-----------------------------------------------------------------------------------------------------------------------

import sys
import os
import json
import fnmatch

import hsaudiotag.auto

#-----------------------------------------------------------------------------------------------------------------------

for root, dir, files in os.walk(sys.argv[1]):
    for item in fnmatch.filter(files, "*.mp3"):
        filePath = os.path.join(root, item)

        tags = hsaudiotag.auto.File(filePath)

        metadata = {
            "title": tags.title,
            "artist": tags.artist,
            "album": tags.album,
            "duration": tags.duration
        }

        with open(filePath.replace('.mp3', '.json'), 'w') as metaFile:
            metaFile.write(json.dumps(metadata))

#-----------------------------------------------------------------------------------------------------------------------
