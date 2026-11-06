"""Legacy entry point: preserve source quality through the fMP4 remux workflow."""
import argparse
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=pathlib.Path)
parser.add_argument('--stage-at', type=float)
args = parser.parse_args()
command = ['node', str(root / 'scripts/remux-film.mjs'), '--source', str(args.source.resolve()), '--segment-seconds', '1']
if args.stage_at is not None:
    command += ['--stage-at', str(args.stage_at)]
subprocess.run(command, cwd=root, check=True)
