#!/usr/bin/env python3
"""Replace ONLY the incorrect Cyrillic В emblem with public/mark.svg.

Keep the audio packets of the existing published MP4 byte-for-byte identical.
Reconstruct the same nine animated slides at scene times taken from the existing
WebVTT (rather than re-generating the voice), and publish the corrected picture.
All narration, captions, scene copy, and statistics stay unchanged. Only the V badge is corrected.
"""
from __future__ import annotations
import hashlib
import importlib.util
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"rendered-logo-patch"
WORK.mkdir(exist_ok=True)
ORIGINAL=WORK/"before.mp4"
CAPTIONS=WORK/"before.uk.vtt"
OUT=WORK/"vorobtsi-intro.mp4"
POSTER=WORK/"vorobtsi-intro-poster.jpg"

def execute(args, *, capture=False):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                          stderr=subprocess.PIPE).stdout

def stamp(x):
    h,m,s=x.split(":")
    return 3600*int(h)+60*int(m)+float(s)

def duration(file):
    s=execute(["ffprobe","-v","error","-show_entries","format=duration",
               "-of","default=noprint_wrappers=1:nokey=1",str(file)],capture=True)
    return float(s.decode().strip())

def audio_hash(file):
    # Hash the AAC payload as remuxed ADTS; must remain precisely identical.
    stream=execute(["ffmpeg","-v","error","-i",str(file),
                    "-map","0:a:0","-c:a","copy","-f","adts","pipe:1"],capture=True)
    return hashlib.sha256(stream).hexdigest()

if not ORIGINAL.is_file() or not CAPTIONS.is_file():
    raise RuntimeError("The previous published MP4 and its captions are required; abort rather than alter the audio")

vtt=CAPTIONS.read_text(encoding="utf-8")
times=[(stamp(a),stamp(b)) for a,b in re.findall(
    r"(?m)^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})$",vtt)]
starts=[times[0][0]]
for (_,prev_end),(nxt_start,_) in zip(times,times[1:]):
    if nxt_start-prev_end>0.8:starts.append(nxt_start)
assert len(starts)==9,f"Expected 9 independent speech scenes, found {len(starts)}"
length=duration(ORIGINAL)
sections=[b-a for a,b in zip(starts,starts[1:]+[length])]
assert all(12 < v < 23 for v in sections),f"Unexpected scene durations: {sections}"

spec=importlib.util.spec_from_file_location("competition_original",ROOT/"tools/build-competition-video.py")
module=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=module
spec.loader.exec_module(module)
assert len(module.SCENES)==9
assert (ROOT/"public/mark.svg").is_file()
module.WORK=WORK
module.WORK.mkdir(exist_ok=True)

segments=[]
for i,seconds in enumerate(sections):
    frame=module.render_slide(module.SCENES[i],i)
    clip=WORK/f"visual-{i:02d}.mp4"
    end=max(.15,seconds-.48)
    execute([
        "ffmpeg","-hide_banner","-loglevel","error","-y",
        "-loop","1","-framerate","24","-i",str(frame),
        "-vf","scale=1360:765,crop=1280:720:x='(iw-ow)*n/480':y='(ih-oh)/2',"
              "fps=24,format=yuv420p,fade=t=in:st=0:d=0.36,"
              f"fade=t=out:st={end:.3f}:d=0.42",
        "-t",f"{seconds:.3f}",
        "-c:v","libx264","-preset","veryfast","-crf","25",
        "-r","24","-an",str(clip)
    ])
    segments.append(clip)
    print(f"Logo fixed on scene {i+1}/9; original audio untouched",flush=True)

manifest=WORK/"visuals.txt"
manifest.write_text("".join("file '"+str(p)+"'\n" for p in segments),encoding="utf8")
video=WORK/"visual-only.mp4"
execute(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat",
         "-safe","0","-i",str(manifest),"-map","0:v:0","-c","copy",str(video)])
# Copy old AAC frames without synthesizing, re-encoding, cutting or changing any narration.
execute(["ffmpeg","-hide_banner","-loglevel","error","-y",
         "-i",str(video),"-i",str(ORIGINAL),"-map","0:v:0","-map","1:a:0",
         "-c:v","copy","-c:a","copy","-movflags","+faststart",str(OUT)])

from PIL import Image
Image.open(WORK/"slide-00.png").save(POSTER,quality=87,optimize=True)

old_hash=audio_hash(ORIGINAL)
new_hash=audio_hash(OUT)
assert old_hash==new_hash, "Voice track differs from previous video; refusing publication"
assert abs(duration(OUT)-length)<0.5, "Video length changed unexpectedly"
assert 100_000 < OUT.stat().st_size < 90_000_000
assert POSTER.stat().st_size>3000
print(f"LOGO PATCH VERIFIED. Original audio SHA256: {old_hash}",flush=True)
print(f"Preserved voice and 9 scenes; changed only official emblem | {duration(OUT):.2f}s | {OUT.stat().st_size} bytes",flush=True)
