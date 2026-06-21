#!/usr/bin/env python3
"""Align 华强买瓜 blues lyrics from AAC frame envelope in fMP4 audio."""
import json
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

AUDIO = Path(__file__).resolve().parents[1] / "src/main/resources/static/audio/bgm.mp3"
if len(sys.argv) > 1:
    AUDIO = Path(sys.argv[1])

LYRICS = [
    "（布鲁斯前奏）",
    "哥们儿",
    "这瓜多少钱一斤？",
    "两块钱一斤",
    "这瓜皮是金子做的",
    "还是瓜粒子是金子做的？",
    "你瞧瞧现在哪有瓜呀？",
    "这都是大棚里的瓜，你嫌贵我还嫌贵呢",
    "给我挑一个",
    "行",
    "这个怎么样？",
    "这瓜保熟吗？",
    "我开水果摊的，能卖给你生瓜蛋子？",
    "我问你，这瓜保熟吗？",
    "你是故意找茬是不是？",
    "你要不要吧！",
    "你这瓜要是熟，我肯定要啊",
    "那它要是不熟怎么办呀？",
    "要是不熟，我自己吃了它，满意了吧！",
    "十五斤，三十块！",
    "你这哪够十五斤？你这秤有问题呀！",
    "吸铁石！",
    "另外你说的，这瓜要是生的，你自己吞进去啊！",
    "你踏马劈我瓜是吧！",
    "萨日朗！萨日朗！",
    "郝哥！",
    "华强！哎！华强！",
    "（布鲁斯 solo）",
    "萨日朗 ~~",
    "（尾奏）",
]


def parse_samples(data: bytes) -> tuple[list[tuple[float, int]], float]:
    def read_box_at(off: int):
        size = struct.unpack(">I", data[off : off + 4])[0]
        typ = data[off + 4 : off + 8].decode("latin1")
        start = off + 16 if size == 1 else off + 8
        if size == 1:
            size = struct.unpack(">Q", data[off + 8 : off + 16])[0]
        return typ, start, off + size

    def find_in(off: int, end: int, typ: str):
        o = off
        while o < end:
            t, s, e = read_box_at(o)
            if t == typ:
                return s, e
            if t in ("moof", "traf", "moov", "trak", "mdia", "minf", "stbl"):
                r = find_in(s, e, typ)
                if r:
                    return r
            o = e
        return None

    mdhd = find_in(0, len(data), "mdhd")
    timescale = struct.unpack(">I", data[mdhd[0] + 12 : mdhd[0] + 16])[0]
    samples: list[tuple[float, int]] = []
    off = 0
    while off < len(data):
        typ, s, e = read_box_at(off)
        if typ == "moof":
            traf = find_in(s, e, "traf")
            if traf:
                tfdt = find_in(traf[0], traf[1], "tfdt")
                trun = find_in(traf[0], traf[1], "trun")
                if tfdt and trun:
                    fs = tfdt[0]
                    ver = data[fs]
                    base = (
                        struct.unpack(">Q", data[fs + 4 : fs + 12])[0]
                        if ver == 1
                        else struct.unpack(">I", data[fs + 4 : fs + 8])[0]
                    )
                    rs = trun[0]
                    flags = int.from_bytes(data[rs + 1 : rs + 4], "big")
                    n = struct.unpack(">I", data[rs + 4 : rs + 8])[0]
                    pos = rs + 8
                    if flags & 0x001:
                        pos += 4
                    if flags & 0x004:
                        pos += 4
                    t = base
                    for _ in range(n):
                        dur = (
                            struct.unpack(">I", data[pos : pos + 4])[0]
                            if flags & 0x100
                            else 1024
                        )
                        pos += 4 if flags & 0x100 else 0
                        sz = (
                            struct.unpack(">I", data[pos : pos + 4])[0]
                            if flags & 0x200
                            else 200
                        )
                        pos += 4 if flags & 0x200 else 0
                        if flags & 0x400:
                            pos += 4
                        if flags & 0x800:
                            pos += 4
                        samples.append((t / timescale, sz))
                        t += dur
        off = e
    return samples, timescale


def envelope(samples: list[tuple[float, int]], win: float = 0.25) -> list[tuple[float, float]]:
    from collections import defaultdict
    import statistics as st

    bins: dict[int, list[int]] = defaultdict(list)
    for t, sz in samples:
        bins[int(t / win)].append(sz)

    out: list[tuple[float, float]] = []
    for b in range(max(bins) + 1):
        arr = bins.get(b, [0])
        if len(arr) > 2:
            score = st.mean(arr) * 0.35 + st.pstdev(arr) * 0.65
        else:
            score = float(arr[0])
        out.append((b * win, score))
    return out


def smooth(vals: list[float], radius: int = 3) -> list[float]:
    out = []
    for i in range(len(vals)):
        chunk = vals[max(0, i - radius) : i + radius + 1]
        out.append(sum(chunk) / len(chunk))
    return out


def find_phrase_starts(env: list[tuple[float, float]], count: int, min_gap: float = 1.85) -> list[float]:
    scores = [v for _, v in env]
    sm = smooth(scores, 4)
    mx = max(sm) or 1.0
    norm = [v / mx for v in sm]

    # vocal onset: rising edge after local minimum
    starts = [0.0]
    last = 0.0
    i = 8  # skip intro ~2s
    while i < len(norm) - 2 and len(starts) < count:
        t = env[i][0]
        if t - last < min_gap:
            i += 1
            continue
        # local min then rise
        if (
            norm[i - 1] < norm[i - 2]
            and norm[i - 1] <= norm[i]
            and norm[i] - norm[i - 1] > 0.06
            and norm[i] > 0.55
        ):
            # refine to nearest local minimum before rise
            j = i - 1
            while j > 0 and norm[j] <= norm[j - 1]:
                j -= 1
            cand = env[max(j, 0)][0]
            if cand - last >= min_gap * 0.85:
                starts.append(round(cand, 2))
                last = cand
                i += int(min_gap / 0.25)
                continue
        i += 1

    # fill remaining evenly
    dur = env[-1][0]
    while len(starts) < count:
        t = dur * len(starts) / count
        starts.append(round(t, 2))
    return starts[:count]


def decode_pcm_wav(src: Path) -> Path | None:
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None

    out = Path(tempfile.gettempdir()) / "blog_bgm_align.wav"
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(out),
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0 or not out.exists():
        return None
    return out


def onset_from_pcm(wav: Path, count: int, min_gap: float = 1.85) -> list[float]:
    with wave.open(str(wav), "rb") as wf:
        rate = wf.getframerate()
        n = wf.getnframes()
        raw = wf.readframes(n)

    # 16-bit mono
    samples = struct.unpack("<" + "h" * (len(raw) // 2), raw)
    win = int(rate * 0.03)
    hop = int(rate * 0.015)
    rms = []
    times = []
    for i in range(0, len(samples) - win, hop):
        chunk = samples[i : i + win]
        s = sum(x * x for x in chunk) / len(chunk)
        rms.append(s**0.5)
        times.append(i / rate)

    # spectral flux proxy: abs diff of rms
    flux = [0.0] + [abs(rms[i] - rms[i - 1]) for i in range(1, len(rms))]
    sm = smooth(flux, 6)
    mx = max(sm) or 1.0
    norm = [v / mx for v in sm]

    starts = [0.0]
    last = 0.0
    min_gap = 1.85
    i = int(2.0 / 0.015)  # skip intro
    while i < len(norm) and len(starts) < count:
        t = times[i]
        if t - last < min_gap:
            i += 1
            continue
        if norm[i] > 0.42 and norm[i] > norm[i - 1] and norm[i] >= norm[i + 1]:
            starts.append(round(t, 2))
            last = t
            i += int(min_gap / 0.015)
            continue
        i += 1

    dur = times[-1] if times else 114.75
    while len(starts) < count:
        starts.append(round(dur * len(starts) / count, 2))
    return starts[:count]


def main() -> None:
    data = AUDIO.read_bytes()
    samples, _ = parse_samples(data)
    dur = samples[-1][0] if samples else 114.75
    env = envelope(samples)
    n = len(LYRICS)

    wav = decode_pcm_wav(AUDIO)
    if wav:
        times = onset_from_pcm(wav, n)
        method = "pcm-onset"
    else:
        times = find_phrase_starts(env, n)
        method = "aac-envelope"

    lines = [{"t": t, "text": text} for t, text in zip(times, LYRICS)]
    out_path = Path(__file__).resolve().parents[1] / "_align.json"
    payload = {"duration": round(dur, 2), "method": method, "lines": lines}
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(out_path)


if __name__ == "__main__":
    main()
