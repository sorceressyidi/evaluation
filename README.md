# Robot Policy Comparison Study

A browser-based human evaluation platform for benchmarking robot manipulation policies through pairwise video comparison. Participants watch side-by-side recordings of robots attempting identical tasks and judge which performed better — enabling large-scale, crowd-sourced policy ranking with rigorous quality control.

## Repository Layout

```
.
├── index.html               # Landing page — participant ID entry & instructions
├── videos.html              # Main study interface (side-by-side video comparisons)
├── quiz_pair_selector.html  # Visual tool for curating quiz & sanity-check pairs
├── videos/
│   ├── pairs.json           # Generated pairwise comparison configurations
│   ├── cogact/              # Videos from the CogACT policy
│   ├── octo/                # Videos from the Octo policy
│   ├── pi0/                 # Videos from the Pi0 policy
│   ├── robovlm/             # Videos from the RoboVLM policy
│   ├── spatial/             # Videos from the Spatial policy
│   ├── xvla/                # Videos from the XVLA policy
│   └── ...
├── scripts/
│   ├── generate.js          # Generates pairs.json from video directories
│   ├── find_quiz_pairs.js   # Locates quiz pairs after regeneration
│   ├── check_videos.js      # Validates video file integrity
│   └── arrange.sh           # Organises raw video files into policy subdirectories
└── backend/
    ├── main.py              # FastAPI server — data collection & live dashboard
    ├── schema.sql           # PostgreSQL schema
    └── README.md            # Backend setup & API reference
```

## Quick Start

### 1. Organise Videos

Place `.mp4` files for each policy under a named subdirectory inside `videos/`. Files that share the same name across directories are treated as competing attempts at the same task and will be automatically paired.

```
videos/
├── cogact/
│   ├── test_move the blue bowl to the upper right_0.mp4
│   └── ...
├── pi0/
│   └── ...
└── xvla/
    └── ...
```

### 2. Generate Video Pairs

```bash
node scripts/generate.js
```

Scans all policy directories and writes every valid pairwise comparison to `videos/pairs.json`. To cap the number of pairs per task, pass a limit as the third argument inside the script.

### 3. Configure Quiz & Sanity-Check Pairs

Open `quiz_pair_selector.html` in a browser to visually inspect video pairs and identify ones with a clear, unambiguous correct answer. Then update `videos.html` with your selections:

```javascript
// Pool of 40 pairs with known correct answers
const ALL_QUIZ_PAIRS = {
  13:   { correct_answer: 'left',  explanation: 'Robot A successfully grasped...' },
  25:   { correct_answer: 'same',  explanation: 'Both robots failed to...' },
  // ...
};

// First 10 indices are used as the initial qualification quiz (paid workers only)
const INITIAL_QUIZ_INDICES = [13, 25, 52, 638, 695, 2544, 4210, 4683, 4790, 8230];
```

### 4. Run the Frontend

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`.

### 5. Set Up the Backend

See [backend/README.md](backend/README.md) for database setup, server configuration, and deployment instructions.

---

## Study Flow

### Paid Workers (Amazon MTurk)

```
Entry
  └── Qualification Quiz  (10 questions — 80% required to pass)
        ├── Fail → Study ends, no completion code issued
        └── Pass → Main Study  (up to 150 video comparisons)
                    ├── Hidden sanity checks injected every 10 videos (2 per batch)
                    ├── Fail ≥ 2 sanity checks → Removed from study
                    └── Complete → Completion code issued for payment
```

### Volunteers (Free Workers)

```
Entry
  └── Main Study  (up to 150 video comparisons)
        ├── Hidden sanity checks injected every 10 videos (2 per batch)
        ├── Fail ≥ 2 sanity checks → Removed from study
        └── Complete → Completion code issued
```

Progress is saved to `localStorage`, so participants can close and resume across sessions.

---

## Configuration

All study parameters are defined at the top of `videos.html`:

```javascript
const STUDY_CONFIG = {
  MAX_MAIN_STUDY_VIDEOS: 150,   // Total comparisons in the main study
  MIN_VIDEOS_TO_FINISH: 30,     // Minimum before "Finish Early" option appears
  QUIZ_PASS_THRESHOLD: 0.8,     // Required accuracy on the initial quiz
  NUM_INITIAL_QUIZ: 10,         // Number of initial quiz questions (paid only)

  SANITY_CHECK: {
    CHECKS_PER_BATCH: 2,        // Sanity checks injected per batch
    BATCH_SIZE: 10,             // Videos per batch
    MAX_FAILURES: 2             // Failures allowed before removal
  }
};
```

### Quiz Pair Allocation

| Worker type | Initial quiz          | Sanity-check pool     |
|-------------|-----------------------|-----------------------|
| Paid        | First 10 pairs        | Remaining 30 pairs    |
| Free        | None                  | All 40 pairs          |

---

## Adding a New Policy

1. **Add videos** — create `videos/<policyname>/` with `.mp4` files following the existing naming convention.
2. **Regenerate pairs** — run `node scripts/generate.js`.
3. **Inspect new pairs** — use `quiz_pair_selector.html` to find suitable quiz candidates.
4. **Update quiz config** — add verified entries to `ALL_QUIZ_PAIRS` in `videos.html`.
5. **Test locally** — confirm videos load and comparisons render correctly before deploying.

---

## Data Format

### Submission Payload (v5.0)

```json
{
  "participant_id": "worker_123",
  "participant_type": "paid",
  "completion_code": "ABC12345",
  "total_time_ms": 450000,
  "response_length": 155,
  "quiz_score": 8,
  "quiz_total": 10,
  "sanity_check_results": [
    { "index": 100, "correct": true,  "position": 5,  "userAnswer": "left",  "correctAnswer": "left"  },
    { "index": 200, "correct": false, "position": 15, "userAnswer": "left",  "correctAnswer": "right" }
  ],
  "sanity_checks_passed": 5,
  "sanity_checks_total": 6,
  "failed": false,
  "failure_reason": null,
  "responses": [
    {
      "answer": "left_42",
      "description_A": "Robot grasped the cup and placed it in the target zone.",
      "description_B": "Robot approached but missed the cup entirely.",
      "type": "regular"
    }
  ],
  "timestamp": "2024-12-08T10:30:00Z",
  "config_version": "v5.0"
}
```

### Response Types

| Type           | Description                                                       |
|----------------|-------------------------------------------------------------------|
| `regular`      | Normal pairwise comparison — used for policy ranking              |
| `quiz`         | Initial qualification question (paid workers only, with feedback) |
| `sanity_check` | Hidden quality-control question (no feedback shown to participant) |

### Failure Reasons

| Reason          | Condition                                           |
|-----------------|-----------------------------------------------------|
| `quiz_failed`   | Scored below 80% on the initial qualification quiz  |
| `sanity_failed` | Failed 2 or more sanity checks during the main study |
