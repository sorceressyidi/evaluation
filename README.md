<div align="center">

# Robot Policy Comparison Study

**A browser-based human evaluation platform for benchmarking robot manipulation policies**\
through pairwise video comparison, qualification quizzes, hidden sanity checks, and multi-algorithm ranking.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 Overview

Participants watch side-by-side recordings of robots attempting identical tasks and judge which performed better — enabling crowd-sourced, publication-quality policy ranking with rigorous quality control. Rankings are computed live by four complementary algorithms: **Bradley-Terry MLE**, **EM with latent task-difficulty buckets**, **Elo**, and **points-based**.

---

## 📁 Repository Layout

```
.
├── index.html                  # Landing page — participant ID entry & instructions
├── videos.html                 # Main study interface — side-by-side video comparisons
├── quiz_pair_selector.html     # Tool for curating quiz & sanity-check pairs
│
├── videos/
│   ├── pairs.json              # Generated pairwise comparison config
│   └── <policy>/               # One subdirectory per policy, containing .mp4 files
│
├── scripts/
│   ├── generate.js             # Generates pairs.json from video directories
│   ├── find_quiz_pairs.js      # Locates quiz pairs after regeneration
│   └── check_videos.js         # Validates video file integrity
│
└── backend/
    ├── config.py               # ← All runtime configuration lives here
    ├── main.py                 # FastAPI server — data collection & live dashboard
    ├── schema.sql              # PostgreSQL schema
    └── README.md               # Backend setup & API reference
```

---

## 🚀 Quick Start

### 1. Organise Videos

Place `.mp4` files for each policy in a named subdirectory under `videos/`. Files that share the same name across directories are treated as competing attempts at the same task and paired automatically.

```
videos/
├── cogact/
│   └── task_name_0.mp4
├── pi0/
│   └── task_name_0.mp4
└── ...
```

### 2. Generate Pairs

```bash
node scripts/generate.js
```

Scans all policy directories and writes every valid pairwise combination to `videos/pairs.json`.

### 3. Configure Quiz & Sanity-Check Pairs

Open `quiz_pair_selector.html` in a browser to visually inspect pairs and identify ones with a clear, unambiguous correct answer. Update `ALL_QUIZ_PAIRS` and `INITIAL_QUIZ_INDICES` in `videos.html` with your selections.

### 4. Run the Frontend

```bash
python3 -m http.server 8080
# → http://localhost:8080/index.html
```

### 5. Set Up the Backend

See **[backend/README.md](backend/README.md)**. All configuration — database credentials, CORS origins, pairs file mapping — lives in `backend/config.py`.

---

## 🎯 Study Design

### Participant Flows

**Paid workers (Amazon MTurk)**
```
Entry ──► Qualification Quiz  (10 questions · 80% pass threshold)
                │
           Pass └──► Main Study  (up to 150 comparisons)
                          │
                          ├── 2 hidden sanity checks per 10-video batch
                          ├── ≥ 2 failures  →  disqualified
                          └── Complete      →  completion code issued
                │
           Fail └──► Study ends immediately
```

**Volunteers**
```
Entry ──► Main Study  (up to 150 comparisons)
               │
               ├── 2 hidden sanity checks per 10-video batch
               ├── ≥ 2 failures  →  disqualified
               └── Complete      →  completion code issued
```

Progress is persisted to `localStorage`, so participants can close and resume across sessions.

### Quality Controls

| Mechanism | Detail |
|-----------|--------|
| Qualification quiz | 10 questions, 80% pass threshold *(paid workers only)* |
| Sanity checks | 2 hidden checks per 10-video batch, drawn from a pool of 40 verified pairs |
| Failure threshold | Disqualified after ≥ 2 incorrect sanity checks |
| Per-video descriptions | Free-text field per video encourages genuine engagement |

---

## ⚙️ Configuration

Study parameters are defined at the top of `videos.html`:

```javascript
const STUDY_CONFIG = {
  MAX_MAIN_STUDY_VIDEOS: 150,
  MIN_VIDEOS_TO_FINISH:  30,
  QUIZ_PASS_THRESHOLD:   0.8,
  NUM_INITIAL_QUIZ:      10,
  SANITY_CHECK: {
    CHECKS_PER_BATCH: 2,
    BATCH_SIZE:       10,
    MAX_FAILURES:     2,
  }
};
```

Backend configuration (database, CORS, pairs versioning, Elo starting ratings) lives in **`backend/config.py`** — the only file you need to edit to deploy.

---

## ➕ Adding a New Policy

1. Create `videos/<policy_name>/` with `.mp4` files following the existing naming convention.
2. Run `node scripts/generate.js` to regenerate `pairs.json`.
3. Open `quiz_pair_selector.html` to identify new sanity-check candidates.
4. Update `ALL_QUIZ_PAIRS` in `videos.html`.
5. Copy `pairs.json` to `backend/` and register the new version in `PAIRS_FILES` inside `backend/config.py`.

---

## 📦 Data Format

Each completed session is submitted as a single JSON payload:

```json
{
  "participant_id":       "worker_123",
  "participant_type":     "paid",
  "completion_code":      "ABC12345",
  "total_time_ms":        450000,
  "response_length":      155,
  "quiz_score":           8,
  "quiz_total":           10,
  "sanity_checks_passed": 5,
  "sanity_checks_total":  6,
  "failed":               false,
  "failure_reason":       null,
  "config_version":       "v5.0",
  "responses": [
    {
      "answer":        "left_42",
      "description_A": "Robot grasped the cup and placed it in the target zone.",
      "description_B": "Robot approached but missed the cup entirely.",
      "type":          "regular"
    }
  ]
}
```

| Response type | Used for |
|---------------|----------|
| `regular` | Policy ranking |
| `quiz` | Qualification *(paid workers, shown with feedback)* |
| `sanity_check` | Quality control *(hidden, no feedback shown)* |
