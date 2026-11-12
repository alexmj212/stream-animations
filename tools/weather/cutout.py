#!/usr/bin/env python3
"""Cut a real photo out of its background for an Exo-Cast ad picture.

AJ (2026-11-12): the dog and cat ads want "a real picture of a cat and
dog", not clip art, but the ad layouts draw transparent cut-outs (#191).
This removes the background with rembg's birefnet-general model (the
cleanest of isnet, u2net and birefnet on fur), trims to the subject and
scales it to 480 px on the long side, like the other ad pictures.

Setup once (the model, ~1 GB, downloads on first run):
    python3 -m venv /tmp/rbg && /tmp/rbg/bin/pip install "rembg[cpu]"
Run:
    /tmp/rbg/bin/python tools/weather/cutout.py <photo.jpg> src/weather/photos/<name>.png

Use CC0 or public-domain photos only, and add a row to
src/weather/photos/CREDITS.md.
"""
import sys

from PIL import Image
from rembg import new_session, remove


def main(src, out, model='birefnet-general'):
    im = Image.open(src).convert('RGB')
    im.thumbnail((1400, 1400))
    cut = remove(im, session=new_session(model))
    alpha = cut.getchannel('A').point(lambda v: 255 if v > 4 else 0)
    cut = cut.crop(alpha.getbbox())
    cut.thumbnail((480, 480), Image.LANCZOS)
    # Zero the colour of fully clear pixels: smaller PNGs
    cut.putdata([p if p[3] else (0, 0, 0, 0) for p in cut.getdata()])
    cut.save(out, optimize=True)
    print(out, cut.size)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
