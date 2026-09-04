from pathlib import Path
import sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")

source = Path(r"C:\Users\salma\Downloads\IGNITE Hackathon 2026 AWS accounts access guide for students.pdf")
reader = PdfReader(source)
for index, page in enumerate(reader.pages, start=1):
    print(f"\n--- PAGE {index} ---\n")
    print(page.extract_text() or "")
