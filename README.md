# Robot Policy Comparison Study

A browser-based human evaluation study for comparing robot manipulation policies. Participants watch side-by-side video clips of robots attempting tasks, describe what each robot did, and choose which performed better.

## Features

- **Dual participant flows**: Paid workers (with qualification quiz) and volunteers (direct entry)
- **Quality control**: Hidden sanity checks distributed throughout the study
- **Progress persistence**: Participants can leave and resume via localStorage
- **Multiple ranking algorithms**: Bradley-Terry MLE, EM with latent buckets, Elo, Points-based
- **Real-time dashboard**: View rankings and statistics as data comes in

## Repository Layout

```
.
├── index.html              # Landing page - participant ID entry
├── videos.html             # Main study interface
├── videos/                 # Video assets and pairs.json
│   ├── pairs.json          # Generated video pair configurations
│   ├── policy1/            # Videos from policy 1
│   ├── policy2/            # Videos from policy 2
│   └── ...
├── scripts/
│   ├── generate.js         # Generates pairs.json from video directories
│   ├── find_quiz_pairs.js  # Helper to locate quiz pairs after regeneration
│   └── arrange.sh          # Helper to organize video files
├── backend/
│   ├── main.py             # FastAPI backend server
│   ├── schema.sql          # PostgreSQL database schema
│   └── README.md           # Backend-specific documentation
└── README.md               # This file
```

## Quick Start

### 1. Organize Videos

Place your policy videos in subdirectories under `videos/`:

```
videos/
├── policy1/
│   ├── test_open_drawer_1.mp4
│   ├── test_pick_cup_2.mp4
│   └── ...
├── policy2/
│   └── ...
└── real/                   # Excluded from pairing (reference only)
```

### 2. Generate Video Pairs

```bash
cd scripts
node generate.js
```

This creates `videos/pairs.json` with all pairwise comparisons.

### 3. Configure Quiz Pairs

Edit `videos.html` and update `QUIZ_PAIRS` with indices from your new `pairs.json`:

```javascript
const QUIZ_PAIRS = {
  10: { correct_answer: 'left', explanation: '...' },
  17: { correct_answer: 'same', explanation: '...' },
  // ... 10 total pairs with known correct answers
};
```

Use `scripts/find_quiz_pairs.js` to help locate pairs after regeneration.

### 4. Start Local Server

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html` in your browser.

### 5. Set Up Backend

```bash
git submodule update --init --recursive
```

See [backend/README.md](backend/README.md) for database setup and deployment instructions.

## Study Flow

### For Paid Workers (Amazon MTurk)
```
Entry → Qualification Quiz (5 questions, 80% to pass)
  ├─ Fail → Study ends, no payment
  └─ Pass → Main Study (150 videos)
            └─ Hidden sanity checks (5) distributed in first 30 videos
            └─ Complete → Completion code for payment
```

### For Volunteers
```
Entry → Main Study (150 videos)
        └─ Hidden sanity checks (10) distributed in first 30 videos
        └─ Complete → Completion code
```

## Configuration

All configuration is in `videos.html`:

```javascript
const STUDY_CONFIG = {
  MAX_MAIN_STUDY_VIDEOS: 150,    // Total videos in main study
  MIN_VIDEOS_TO_FINISH: 30,      // Minimum before "Finish Early" appears
  QUIZ_PASS_THRESHOLD: 0.8,      // 80% correct to pass quiz
  NUM_INITIAL_QUIZ: 5,           // Quiz questions for paid workers
  
  SANITY_CHECK: {
    DISTRIBUTION_PAID: [[5, 30]],   // 5 checks in first 30 videos
    DISTRIBUTION_FREE: [[10, 30]]   // 10 checks in first 30 videos
  }
};
```

## Adding a New Policy

1. **Add videos**: Create `videos/newpolicy/` with `.mp4` files named by task
2. **Update generate.js**: Set `NUM_VIDEOS` to match your policy count
3. **Regenerate pairs**: Run `node scripts/generate.js`
4. **Update quiz config**: Find new indices for your quiz pairs
5. **Test locally**: Verify videos load and comparisons work

## Data Format

### Response Payload

```json
{
  "participant_id": "worker_123",
  "participant_type": "paid",
  "completion_code": "ABC12345",
  "total_time_ms": 450000,
  "response_length": 155,
  "quiz_score": 4,
  "quiz_total": 5,
  "sanity_checks_passed": 5,
  "sanity_checks_total": 5,
  "failed": false,
  "responses": [
    {
      "answer": "left_42",
      "description_A": "Robot grasped the cup successfully",
      "description_B": "Robot missed the cup entirely",
      "type": "regular"
    }
  ],
  "timestamp": "2024-12-08T10:30:00Z"
}
```

### Response Types
- `"quiz"`: Initial qualification questions (paid workers only)
- `"sanity_check"`: Hidden quality control questions
- `"regular"`: Normal comparison questions (used for ranking)

