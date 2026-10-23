#!/usr/bin/env python3
"""用 edge-tts 把 tools/tts_texts.json 全部合成 MP3 → audio/<sha1>.mp3"""
import asyncio, hashlib, json, os, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = "/home/ubun/work/unit3"
import edge_tts

VOICE = "en-US-AriaNeural"
RATE = "-10%"
AUDIO = os.path.join(ROOT, "audio")
texts = json.load(open(os.path.join(ROOT, "tools", "tts_texts.json")))

def fname(t):
    return hashlib.sha1(t.encode("utf-8")).hexdigest()[:16] + ".mp3"

jobs = []
for t in texts:
    f = os.path.join(AUDIO, fname(t))
    if not (os.path.exists(f) and os.path.getsize(f) > 1500):
        jobs.append((t, f))
print(f"共 {len(texts)} 条，需合成 {len(jobs)} 条", flush=True)

sem = asyncio.Semaphore(5)
async def synth(t, f):
    async with sem:
        for attempt in range(4):
            try:
                com = edge_tts.Communicate(t, VOICE, rate=RATE)
                await com.save(f)
                if os.path.getsize(f) > 1500:
                    return True
            except Exception as e:
                await asyncio.sleep(1.5 * (attempt + 1))
        print("FAILED:", t[:60], flush=True)
        return False

async def main():
    done = 0
    tasks = [asyncio.create_task(synth(t, f)) for t, f in jobs]
    for i, coro in enumerate(asyncio.as_completed(tasks)):
        await coro
        done += 1
        if done % 25 == 0:
            print(f"进度 {done}/{len(jobs)}", flush=True)

asyncio.run(main())
ok = sum(1 for t in texts if os.path.exists(os.path.join(AUDIO, fname(t))) and os.path.getsize(os.path.join(AUDIO, fname(t))) > 1500)
print(f"完成: {ok}/{len(texts)}")
