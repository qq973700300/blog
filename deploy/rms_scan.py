import struct
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg

src = Path(r"c:\Users\92112\Downloads\华强买瓜 但是布鲁斯_音频.mp3")
out = Path(tempfile.gettempdir()) / "t.wav"
subprocess.run(
    [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", str(src), "-ac", "1", "-ar", "16000", "-f", "wav", str(out)],
    capture_output=True,
    check=True,
)
wf = wave.open(str(out), "rb")
raw = wf.readframes(wf.getnframes())
samples = struct.unpack("<" + "h" * (len(raw) // 2), raw)
rate = wf.getframerate()
for sec in range(0, int(len(samples) / rate)):
    a = sec * rate
    b = min(len(samples), (sec + 1) * rate)
    chunk = samples[a:b]
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    bar = int(rms / 250)
    if sec <= 30 or sec >= 70:
        print(f"{sec:3d}s {'#' * min(bar, 50)} {rms:.0f}")
