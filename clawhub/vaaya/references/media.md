# Media generation — images, video, music, voice, demo videos

All generative models route through one action. Pick a `model` key from the tables below;
other params (`prompt`, `image_url`, `aspect_ratio`, `duration`, `text`, …) vary per model.

```
use({ service: "fal", action: "generate",
      params: { model: "<model-key>", ...model-params }, max_cost_cents: 100 })
```

**Quality first.** Users want the best result, not the cheapest. `max_cost_cents` is a
safety ceiling against runaway spend, never an optimization target — set it high enough for
the correct pipeline. Pick the cheaper of two models only when quality is otherwise equal.

## Sync vs async

- **Images and audio are SYNC.** The file URL comes back inline in the `use` response —
  capture and save it immediately. Never re-run `use` to "recover" a lost URL (that is a
  new paid generation); call `result({ job_id: <transaction_id> })` to replay a stored result.
- **Video, lipsync, video background removal, subtitles, and renders are ASYNC.** `use`
  returns `{ job_id, async: true }` immediately. Poll `result({ job_id })` until
  `status: "succeeded"`. Never re-run `use` to check — that starts a new paid job. Firing
  several async jobs in parallel is fine.
- `gpt-image-2` is slow even as a sync call — run it one at a time, never batched.

## Staging input files — `fal/upload` (1¢)

Any file feeding a generation (reference image, photo, video for lipsync, audio track)
must be reachable when the job runs. Presigned `files/get` URLs expire in ~1h and async
jobs can queue longer — so stage inputs on the model CDN first:

```
use({ service: "fal", action: "upload",
      params: { file_name: "ref.png", content_type: "image/png" }, max_cost_cents: 5 })
→ { upload_url, file_url }        // PUT the raw bytes to upload_url, then pass file_url
```

Pass `file_url` as `image_url` / `image_urls` / `video_url` / `audio_url`. Outputs of
earlier generations are already on the CDN — pass those URLs straight through.
**Never compress, downscale, or re-encode an input before uploading** — upload originals
at full resolution (pricing does not scale with input size; compression wrecks outputs).

## Images — generation

When to pick:
- **Default for everything photographic** (heroes, backgrounds, people, abstract brand
  visuals, social/OG cards) → `nano-banana-pro`. Most photoreal model; up to 4K.
- **Readable text inside the image** (diagrams, infographics, labels, flowcharts) →
  `gpt-image-2`. The only model with reliable in-image text. Slow; one at a time.
- **Photoreal human/scene still, especially one you will animate** →
  `seedream--v5-pro--text-to-image`. Bulk/iteration where quality already suffices →
  `seedream--v4-5--text-to-image` (4¢).

| Model key | Price | Notes |
|---|---|---|
| `nano-banana-pro` | 33¢ | Params: `prompt`, `aspect_ratio` (`1:1` `16:9` `4:3` `3:4` `9:16` …), `resolution` (`1K`/`2K`/`4K`). Character consistency via reference `image_url`. |
| `gpt-image-2` | 24¢ | Params: `prompt`, `image_size` as `{width,height}` object (1024×1024, 1536×1024, 1024×1536); a `"1024x1024"` string is auto-coerced. |
| `seedream--v5-pro--text-to-image` | 18¢ | Up to 2K. Pass `enable_safety_checker: true` when generating images. |
| `seedream--v4-5--text-to-image` | 4¢ | Cheap sibling for bulk/iteration. Pass `enable_safety_checker: true`. |

Gotchas:
- **Nano Banana Pro takes ratios + resolution tiers, not exact pixels.** Generate the
  closest aspect ratio at `4K`, then crop/downscale to the target where the image is used
  (OG card 1200×630 → `16:9` @ `4K`, crop to 1.9:1). Extreme banner ratios (728×90) cannot
  be generated directly — crop from `16:9`/`9:16`, or hand-author SVG/HTML.
- Always generate at the highest resolution the model offers; downscale only at placement.
- `content_policy_violation` responses charge nothing — reword the flagged phrase and retry.
- For a precise diagram, exact wordmark, or real data viz, author an SVG instead of
  fighting an image model.

## Images — editing and background removal

Edit variants **require an image input**: pass the source as `image_url` or `image_urls`
(either is accepted; edits take an array, and a single `image_url` is auto-wrapped).
Stage local files via `fal/upload` first.

| Model key | Price | Notes |
|---|---|---|
| `nano-banana-pro--edit` | 33¢ | Default editor — photoreal, character-consistent edits. |
| `seedream--v5-pro--edit` | 18¢ | Photoreal editing/compositing; multi-image `image_urls`. |
| `seedream--v4-5--edit` | 4¢ | Budget edit sibling. |
| `gpt-image-2--edit` | 24¢ | Edit while adding readable text/labels. |
| `image-background-removal` | 5¢ | Sync. Param: `image_url`. Returns transparent PNG cutout. |

## Video — generation

Route on the CONTENT of the ask, not the words the caller used:
- **A real scene — characters, dialogue, a skit, a parody, a show/movie moment** →
  `minimax-h3--reference-to-video`. If you can name or describe the characters, or there
  is any dialogue, it is a reference-to-video job — even if the caller said "text-to-video".
- **Animate one subject / one composed frame** → generate the still with
  `seedream--v5-pro--text-to-image`, stage it with `fal/upload`, then
  `minimax-h3--image-to-video`.
- **B-roll, generated motion, abstract brand visuals** → Seedance 2.0 (Kling only when
  Seedance's variant/price mix doesn't fit).
- **Text-to-video is a last resort** for vague asks with no describable characters, no
  dialogue, no concrete scene.

| Model key | Price | Notes |
|---|---|---|
| `minimax-h3--reference-to-video` | ~34¢/s @2K | **Scene default.** `prompt` (shot script), `reference_image_urls[]`, `duration` 5–15, `aspect_ratio`. First 5 refs free, ~11¢ each beyond. |
| `minimax-h3--image-to-video` | ~34¢/s @2K | `prompt`, `image_url` (first frame; output aspect follows it), optional `end_image_url`, `duration` 5–15. |
| `minimax-h3--text-to-video` | ~34¢/s @2K | Vague asks only. `prompt`, `duration`, `aspect_ratio`. |
| `seedance-2-0--fast--image-to-video` | 135¢ | Cheapest image-to-video. 480p/720p only. |
| `seedance-2-0--fast--reference-to-video` | 134¢ | Fast from reference. 480p/720p only. |
| `seedance-2-0--image-to-video` | 336¢ | Standard; adds 1080p. |
| `seedance-2-0--reference-to-video` | 677¢ | Standard from reference; 1080p. |
| `seedance-2-0--fast--text-to-video` | 400¢ | 480p/720p only. |
| `seedance-2-0--text-to-video` | 500¢ | Standard; 1080p. |
| `kling-video--v3--pro--text-to-video` | 185¢ | Cheapest text-to-video. |
| `kling-video--v3--pro--image-to-video` | 185¢ | |
| `kling-video--v3--standard--text-to-video` | 208¢ | |
| `kling-video--v3--standard--image-to-video` | 208¢ | |

Gotchas:
- **All clips cap at 15s.** Longer pieces = segment the script and stitch (see CueFrame).
- **H3 is billed per second** — always pass an explicit `duration` (defaults to a short 5s
  otherwise). Resolution is pinned to 2K. `max_cost_cents: 1521` covers the 15s max plus a
  large reference cast.
- **H3 is unrestricted** — real people, celebrities, film/TV recreations work. For a
  reference-to-video scene: search the web for the REAL image of every named character,
  `fal/upload` each uncompressed, pass them in `reference_image_urls` in order, and write
  the prompt as a shot script referring to `Image 1`, `Image 2`, … with `DIALOGUE:` lines,
  explicit cuts/zooms, and a closing `STYLE:` line. The likeness comes entirely from the
  references — skip them and the model invents the cast.
- Respect provider content-filter refusals; report the refusal rather than switching providers or rewording a request to evade it.
- Seedance `--fast` variants error on `resolution: "1080p"` (480p/720p only). Full-frame
  deliverables → standard variant at 1080p; reserve fast/720p for small tiles (PIP).

## Lipsync and avatar building blocks

No turnkey avatar recipe ships today — these are atomic blocks (avatar frame via
`nano-banana-pro--edit`, voiceover via TTS below, then):

| Model key | Price | Notes |
|---|---|---|
| `seedance-2-0--fast--image-to-video` | 135¢ | Talking-head loop: set `image_url` = `end_image_url` = avatar frame, `generate_audio: true`. |
| `sync-lipsync--v2` | 500¢ | Async. Sync a talking-head video to an audio track: `video_url`, `audio_url`. Loop mode is preset, so a short seamless clip auto-covers a longer voiceover. Pass `max_cost_cents: 550`. |
| `video-background-removal` | 20¢ | Async. Alpha-channel cutout of a person from video: `video_url`, `output_codec: "vp9"`. Only for the full-frame cut-out presenter look. |

## Subtitles — `video-subtitles` (80¢, async)

Auto-transcribes a video and burns in styled captions. Params: `video_url`, `preset`,
`language` (e.g. `en-US`), `customization { position top|center|bottom, shadow
none|min|mid|max, text_customizations.baseline { font, color } }`. Returns
`{ video: { url } }`.

## Music — `minimax-music--v2-6` (15¢, sync)

Instrumental background bed, never a song — no-vocals and lossless WAV output are preset.
One param: `prompt` (style/mood/genre/BPM, e.g. "uplifting energetic electronic track,
driving beat, modern tech-product feel, 120 BPM"). **No duration param** — the track is a
fixed length and the video assembler loops + trims it, so generate it last.

## Text-to-speech

- **Polished narration/voiceover (default)** → `elevenlabs--tts--turbo-v2-5`.
- **Budget/utility speech** (IVR, drafts, high volume) → `deepgram/speak`.
- **Indian languages / Indian-accent English** → `sarvam/speak`.

| Service call | Price | Params |
|---|---|---|
| fal `elevenlabs--tts--turbo-v2-5` | 5¢ / 1000 chars (5¢ min) | `text` (the EXACT words to speak — no stage directions, no markdown), `voice` (preset name below, default `Liam`), optional `language_code` (ISO 639-1). Pace is pinned to a natural speed 1. |
| fal `seed-speech--tts--v2` | 3¢ / 1000 chars (3¢ min) | `text`, `voice` (seed-speech voice id), `speed` 0.5–2.0 (default 1.2). Budget alternative for direct callers. |
| `deepgram/speak` | 1¢ / 250 chars (2¢ min) | `text` (max 2,000 chars — chunk longer), `voice` (default `aura-2-thalia-en` clear female; `aura-2-apollo-en` confident male, `aura-2-asteria-en` warm female, `aura-2-orion-en` deep male, `aura-2-zeus-en` authoritative male). Returns hosted MP3 `url`. |
| `sarvam/speak` | 1¢ / 250 chars (2¢ min) | `text` (max 1,500 chars), `target_language_code` required (e.g. `"hi-IN"`, `"en-IN"`), optional `speaker` (`anushka`/`manisha`/`vidya` female, `abhilash`/`karun`/`hitesh` male). Returns hosted WAV `url`. |

ElevenLabs voice roster (pick by the on-screen presenter's apparent gender/age/energy;
VO-only or unsure → `Liam` male / `Rachel` female): female — `Rachel` (calm narration),
`Aria` (expressive, warm), `Sarah` (soft news-read), `Laura` (upbeat, bright),
`Charlotte` (smooth, polished), `Alice` (warm British), `Matilda` (trustworthy narration),
`Lily` (gentle, professional), `Jessica` (lively, playful); male — `Liam` (confident
narration, **default**), `Brian` (deep, resonant), `George` (warm British, mellow),
`Will` (chill, conversational), `Eric` (smooth, classy), `Chris` (casual, everyday),
`Daniel` (authoritative news-anchor), `Bill` (warm, grandfatherly), `Roger` (easy-going).

## Product demo videos

**The one demo path is `vaaya/produce_autodemo`** — capture-first: you record the live
product yourself, Vaaya watches the recording and internally cuts/trims/speeds/zooms it,
writes and voices the narration, assembles, renders, and burns in subtitles. You make no
`fal/*` or `cueframe/*` calls for a demo. The flow:

1. **Capture** — drive the product in a local headed Playwright browser and screen-record
   the real screen (aperture on macOS, ffmpeg ddagrab on Windows; Linux unsupported). One
   continuous silent take, 30–160s. Never ask the user for a pre-made video; if the product
   is login-gated the user signs in themselves — you never touch credentials. Log an
   interaction track of focus beats `[{ t, x, y, kind: click|highlight|type, intent }]`
   (coords normalized 0–1 to the full screen). Normalize to CFR H.264 at `-crf 18`
   (never downscale) and `ffprobe` the true duration.
2. **Describe** — four fields: `whatItDoes`, `builderIntent`, `company`, `useCases`.
3. **Hand off** — `files/upload` the recording, then ONE call to `vaaya/produce_autodemo`
   with `recording` (file_id), `feature`, `recordingDurationSec`, and `clicks` (the
   interaction track — it makes zoom placement pixel-accurate). Omit `targetDurationSec`,
   `voice`, and `name` unless the user explicitly gave them.
4. **Deliver** — the call returns `{ job_id, async: true }`; poll `result({ job_id })`
   until the final video URL. Never re-run to check.

**Assembling any other video yourself — the `cueframe/*` chain.** CueFrame is the single
video assembler (never pre-combine assets with ffmpeg/ImageMagick). `vaaya/produce_demo`
is the lower-level demo sibling of the same chain; prefer `produce_autodemo` for demos.
Steps, in order:

| Action | Price | Notes |
|---|---|---|
| `cueframe/upload` | 1¢ | `{ file_id }` from `files/upload` → `{ media_id }`. Once per asset. |
| `cueframe/create_project` | 1¢ | `{ name, format: { aspectRatio, fps, resolution } }`. |
| `cueframe/validate` | 1¢ | Dry-run the composition. **Always validate first** — invalid clips are silently dropped and a paid render then fails with "Composition has no scenes". |
| `cueframe/put_composition` | 1¢ | `{ project_id, ...composition }` (the validated one). |
| `cueframe/render` | $1, async | `intent: "preview"` for a draft, `"final"` for the deliverable. Poll `result(job_id)`; never re-run render to check. |

Composition = `{ v: 1, format, tracks[] }`; tracks (`video|audio|image|overlay|effect`)
hold clips `{ id, startTime, duration, source }`; a media source reuses one `mediaId`
across clips with per-clip `trim`/`playbackRate` to turn one take into edited beats.
Auto-zoom = `source.reframe.segments[]` of `{ startSec, endSec, focus, zoom }` — `zoom` is
the visible-frame fraction (1.0 = full frame, smaller = tighter, range 0.1–1.0).
**Never set `zoom` > 1.0** — the clip is silently dropped and the render fails. `ease` is
an object `{ in, out }` (seconds), not a string. Only video goes on a `video` track (a
still image needs its own `image` track). Render `"final"` for the deliverable; never
ship a preview.
