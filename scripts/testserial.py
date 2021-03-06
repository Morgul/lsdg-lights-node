#!/usr/bin/env python
"""Test the LSDG lights app, emulating the Raspberry Pi light controller.

This script opens a pseudo-TTY to emulate a serial port connected to the RPi, and then displays light states in a
vaguely "graphical" fashion on the console.

"""
from __future__ import print_function
import os
import pty
import re
import subprocess
import sys
import time
import traceback


lightCount = 32

lightCmdRE = re.compile(r'p(\d+)s([01])')


# Open a pseudo-TTY to emulate a serial port.
master, slave = pty.openpty()

env = dict(os.environ)
env['LSDG_LIGHTS_SERIAL'] = os.ttyname(slave)


print("Running 'npm start' with LSDG_LIGHTS_SERIAL={!r}...".format(env['LSDG_LIGHTS_SERIAL']))
proc = subprocess.Popen(["npm", "start"], env=env)


try:
    lightStates = [False] * lightCount

    def showLightStates():
        sys.stdout.write('\033[s\033[1;1H\033[2K\033[3;1H\033[2K\033[2;3H\033[2K{}\033[m\033[u'.format(
            ' '.join(
                '\033[93m\\!/' if state else '\033[90m . '
                for state in lightStates
                )
            ))

        sys.stdout.flush()

    showLightStates()

    buf = ''
    while True:
        buf += os.read(master, 1)

        idx = buf.rfind('\n')
        if idx >= 0:
            for line in buf[:idx].split('\n'):
                for match in lightCmdRE.finditer(line):
                    channel, state = map(int, match.group(1, 2))

                    try:
                        lightStates[channel] = bool(state)
                    except KeyError:
                        print('\033[1;31mERROR:\033[0;91m Invalid channel number {!r}! (must be between 0 and {})'
                                .format(channel, lightCount - 1))
                    except:
                        print('\033[1;31mERROR:\033[0;91m Exception while setting light states!\n{}\033[m'
                                .format(traceback.format_exc()))

                showLightStates()

            buf = buf[idx + 1:]

finally:
    if proc.poll() is None:
        sys.stdout.write('\033[s\033[1;1H\033[2K\033[3;1H\033[2K\033[2;3H\033[2K\033[m\033[u')
        sys.stdout.flush()

        proc.terminate()

        time.sleep(2)

        if proc.poll() is None:
            proc.kill()
