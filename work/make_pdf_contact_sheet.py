from pathlib import Path
from PIL import Image, ImageDraw

folder = Path("work/pdfs/rendered")
files = sorted(folder.glob("page-*.jpg"))
thumbs = []
for index, file in enumerate(files, start=1):
    image = Image.open(file).convert("RGB")
    image.thumbnail((360, 203))
    canvas = Image.new("RGB", (380, 235), "white")
    canvas.paste(image, ((380 - image.width) // 2, 22))
    ImageDraw.Draw(canvas).text((10, 5), f"Page {index}", fill="black")
    thumbs.append(canvas)

cols = 3
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 380, rows * 235), "#d8d8d8")
for index, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((index % cols) * 380, (index // cols) * 235))
sheet.save("work/pdfs/contact-sheet.jpg", quality=88)
