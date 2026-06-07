import os
from datetime import date, timedelta

# Start: June 8, 2026 (Monday). End: last Monday of 2026.
start_date = date(2026, 6, 8)
end_date   = date(2026, 12, 31)

files_to_create = ["monday.txt", "tuesday.txt", "wednesday.txt", "thursday.txt"]

current = start_date
folders_created = 0

while current <= end_date:
    # Format: "June 8, 2026" (no zero-padding on day)
    folder_name = f"{current.strftime('%B')} {current.day}, {current.year}"

    os.makedirs(folder_name, exist_ok=True)

    for filename in files_to_create:
        filepath = os.path.join(folder_name, filename)
        with open(filepath, "w") as f:
            pass  # create empty file

    print(f"Created: {folder_name}/")
    folders_created += 1

    current += timedelta(weeks=1)  # jump to next Monday

print(f"\nDone! {folders_created} folders created.")