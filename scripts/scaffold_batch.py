"""Copy the shared starter into a new, empty output directory."""
import argparse
import json
from pathlib import Path
import shutil

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--topics', default='lens,lever,magnet')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / 'assets/courseware-starter'
manifest = json.loads((source / 'public/batch.json').read_text(encoding='utf-8'))
requested = [key.strip() for key in args.topics.split(',') if key.strip()]
available = {row['id']: row for row in manifest['lessons']}
if not requested or len(set(requested)) != len(requested):
    parser.error('Choose one or more unique topic IDs')
unknown = set(requested) - available.keys()
if unknown:
    parser.error('These topics need a new model implementation: ' + ', '.join(sorted(unknown)))
if args.output.exists() and any(args.output.iterdir()):
    parser.error('Output directory must be empty; existing projects should be edited in place')
if args.output.resolve().is_relative_to(source.resolve()):
    parser.error('Copy to a project outside the skill template')
shutil.copytree(source, args.output, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('node_modules', 'dist', 'captures', '.vite'))
manifest['lessons'] = [available[key] for key in requested]
(args.output / 'public/batch.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output': str(args.output.resolve()), 'topics': requested,
                  'next_steps': ['npm ci', 'npm test', 'npm run dev']}, ensure_ascii=False, indent=2))
