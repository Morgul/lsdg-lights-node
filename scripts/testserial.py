import os
import re
import subprocess
import sys
import time


lightCount = 32

lightCmdRE = re.compile(r'p(\d+)s([01])')

master, slave = os.openpty()

print(os.ttyname(master))
print(os.ttyname(slave))

env = dict(os.environ)
env['LSDG_LIGHTS_SERIAL'] = os.ttyname(slave)

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

                    lightStates[channel] = bool(state)

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
