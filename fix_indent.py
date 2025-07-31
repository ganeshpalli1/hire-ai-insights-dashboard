import re

# Read the file
with open('resumematching.py', 'r') as f:
    lines = f.readlines()

# Fix line 3638-3641 (0-indexed would be 3637-3640)
if len(lines) > 3640:
    # Line 3638 should have 20 spaces indentation
    lines[3637] = ' ' * 20 + 'return {\n'
    lines[3638] = ' ' * 24 + '"status": "error",\n'
    lines[3639] = ' ' * 24 + '"error": f"Candidate {candidate_id} not found in database or memory. This candidate may have been deleted or the data was not properly saved."\n'
    lines[3640] = ' ' * 20 + '}\n'

# Write back
with open('resumematching.py', 'w') as f:
    f.writelines(lines)

print("Fixed indentation issues") 