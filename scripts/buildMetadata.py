#!/usr/bin/env python
"""Build a metadata json file for the given targets.

Usage:
    $ scripts/buildMetadata.py [OPTIONS] [TARGET ...]

Options:
    -h, --help           display this help message
    -m, --metadata-only  only generate metadata for the targets (don't generate FFT output)

Targets may be files or directories; for directories, all mp3 files in each directory will be processed.

"""
from __future__ import print_function
import sys
import os
from os.path import isdir, isfile
import json
import fnmatch
import traceback

import hsaudiotag.auto

from generateFFT import generateFFT

#-----------------------------------------------------------------------------------------------------------------------


def error(message, *args, **kwargs):
    """Report an error to the user.

    """
    if args or kwargs:
        message = message.format(*args, **kwargs)
    print("\033[1;31mError:\033[0;91m {}\033[m".format(message), file=sys.stderr)

#-----------------------------------------------------------------------------------------------------------------------

# Initial values
metadataOnly = False

targets = list()

# Process command-line arguments.
args = sys.argv[1:]

if '--' in args:
    # Anything after '--' is protected from being an option.
    targets = args[args.index('--') + 1:]
    args = args[:args.index('--')]

if not args or '-h' in args or '--help' in args:
    # Display help and exit.
    print(__doc__.strip(), file=sys.stderr)
    sys.exit(1)

while '-m' in args:
    args.remove('-m')
    metadataOnly = True
while '--metadata-only' in args:
    args.remove('--metadata-only')
    metadataOnly = True

invalidOptions = [repr(arg) for arg in args if arg.startswith('-')]
if invalidOptions:
    # Unrecognized options found; display error and help, and exit.
    error("Unrecognized option{}: {}", '' if len(invalidOptions) == 1 else 's', ', '.join(invalidOptions))
    print()
    print(__doc__.strip(), file=sys.stderr)
    sys.exit(1)

# All remaining arguments should be targets.
targets.extend(args)

#-----------------------------------------------------------------------------------------------------------------------


def processFile(filePath):
    """Generate metadata and possibly FFT output for the given file.

    """
    sys.stdout.write("Processing {!r}... ".format(filePath))
    sys.stdout.flush()

    tags = hsaudiotag.auto.File(filePath)

    metadata = {
        "title": tags.title,
        "artist": tags.artist,
        "album": tags.album,
        "duration": tags.duration
    }

    if not metadataOnly:
        try:
            metadata.update(generateFFT(filePath))
        except KeyboardInterrupt:
            print("Aborted.")
            sys.exit(1)
        except:
            print()
            error("Exception while generating FFT for {!r}:\n{}", filePath, traceback.format_exc().rstrip())

    with open(filePath.replace('.mp3', '.json'), 'w') as metaFile:
        metaFile.write(json.dumps(metadata))

    print("Done.")

#-----------------------------------------------------------------------------------------------------------------------

for target in targets:
    if isdir(target):
        for root, dir, files in os.walk(target):
            for item in fnmatch.filter(files, "*.mp3"):
                filePath = os.path.join(root, item)
                processFile(filePath)

    elif isfile(target):
        processFile(target)

    else:
        error("Target {!r} is not a file or directory! (does file exist?)", target)

#-----------------------------------------------------------------------------------------------------------------------
