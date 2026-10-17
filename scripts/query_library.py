"""Retrieve a small selection from the bundled public teaching-reference library."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--library', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/knowledge-library.json')
parser.add_argument('--query', default='')
parser.add_argument('--category', default='')
parser.add_argument('--id', default='')
parser.add_argument('--limit', type=int, default=5)
parser.add_argument('--audience', choices=['teacher', 'student', 'both'], default='teacher')
args = parser.parse_args()
if args.limit < 1:
    parser.error('--limit must be at least 1')
data = json.loads(args.library.read_text(encoding='utf-8'))
rows = data['resources']
tokens = args.query.lower().split()
selected = []
for row in rows:
    merged = row.get('merged_resources', [])
    if args.id and row['id'] != args.id and not any(item['id'] == args.id for item in merged):
        continue
    if args.category and row['category'] != args.category:
        continue
    title = (row['title'] + ' ' + ' '.join(item['title'] for item in merged)).lower()
    notes = (row.get('teacher_notes_md', '') + row.get('student_notes_md', '')).lower()
    score = sum(10 if word in title else 1 if word in notes else 0 for word in tokens)
    if tokens and not score:
        continue
    selected.append((score, row))
selected.sort(key=lambda item: -item[0])
results = []
for _, row in selected[:args.limit]:
    result = {key: row.get(key) for key in ['index', 'id', 'title', 'category', 'resource_type', 'source_url', 'quality_flags',
        'teaching_level', 'curriculum_alignment', 'development_target', 'acceptance_cases', 'review', 'merged_resources']}
    if args.id and row['id'] != args.id:
        result['resolved_from_merged_id'] = args.id
    for field, audience in [('teacher_notes_md', 'teacher'), ('student_notes_md', 'student')]:
        if args.audience in (audience, 'both'):
            text = row.get(field, '')
            result[field] = text if args.id else text[:1600]
    results.append(result)
print(json.dumps({'matched': len(selected), 'returned': len(results), 'resources': results}, ensure_ascii=False, indent=2))
