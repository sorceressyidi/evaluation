# Robot Policy Comparison Study

A browser-based human evaluation study for comparing robot manipulation policies. Participants watch side-by-side video clips of robots attempting tasks, describe what each robot did, and choose which performed better.

## Features

- **Dual participant flows**: Paid workers (with qualification quiz) and volunteers (direct entry)
- **Quality control**: Hidden sanity checks distributed throughout the study (2 per every 10 videos)
- **Progress persistence**: Participants can leave and resume via localStorage
- **Quiz pair selector**: Visual tool for selecting and verifying quiz pairs
- **Multiple ranking algorithms**: Bradley-Terry MLE, EM with latent buckets, Elo, Points-based
- **Real-time dashboard**: View rankings and statistics as data comes in

## Repository Layout

```
.
├── index.html              # Landing page - participant ID entry
├── videos.html             # Main study interface
├── quiz_pair_selector.html # Visual tool for selecting quiz pairs
├── videos/                 # Video assets and pairs.json
│   ├── pairs.json          # Generated video pair configurations
│   ├── cogact/             # Videos from CogACT policy
│   ├── octo/               # Videos from Octo policy
│   ├── pi0/                # Videos from Pi0 policy
│   ├── robovlm/            # Videos from RoboVLM policy
│   ├── spatial/            # Videos from Spatial policy
│   ├── xvla/               # Videos from XVLA policy
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
├── cogact/
│   ├── test_Move_the_can_to_the_right_of_the_pot_0.mp4
│   └── ...
├── pi0/
│   └── ...
├── xvla/
│   └── ...
└── output/                 # Excluded from pairing (reference only)
```

### 2. Generate Video Pairs

```bash
cd scripts
node generate.js
```

This creates `videos/pairs.json` with all pairwise comparisons.

### 3. Configure Quiz Pairs

Edit `videos.html` and update `ALL_QUIZ_PAIRS` with indices from your `pairs.json`:

```javascript
const ALL_QUIZ_PAIRS = {
  13: { correct_answer: 'left', explanation: '...' },
  25: { correct_answer: 'same', explanation: '...' },
  // ... 40 total pairs with known correct answers
};

// First 10 are used for initial quiz (paid workers only)
const INITIAL_QUIZ_INDICES = [13, 25, 52, 638, 695, 2544, 4210, 4683, 4790, 8230];
```

Use `quiz_pair_selector.html` to visually select and verify quiz pairs.

### 4. Start Local Server

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html` in your browser.

### 5. Set Up Backend

```bash
git submodule update --init --recursive
```

See [backend/README.md](backend/README.md) for database setup and deployment instructions.

## Study Flow

### For Paid Workers (Amazon MTurk)
```
Entry → Qualification Quiz (10 questions, 80% to pass)
  ├─ Fail → Study ends, no payment
  └─ Pass → Main Study (up to 150 videos)
            └─ Hidden sanity checks: 2 per every 10 videos
            └─ Fail 2 sanity checks → Kicked out
            └─ Complete → Completion code for payment
```

### For Volunteers (Free Workers)
```
Entry → Main Study (up to 150 videos)
        └─ Hidden sanity checks: 2 per every 10 videos
        └─ Fail 2 sanity checks → Kicked out
        └─ Complete → Completion code
```

## Configuration

All configuration is in `videos.html`:

```javascript
const STUDY_CONFIG = {
  MAX_MAIN_STUDY_VIDEOS: 150,    // Total videos in main study
  MIN_VIDEOS_TO_FINISH: 30,      // Minimum before "Finish Early" appears
  QUIZ_PASS_THRESHOLD: 0.8,      // 80% correct to pass initial quiz
  NUM_INITIAL_QUIZ: 10,          // Quiz questions for paid workers
  
  SANITY_CHECK: {
    CHECKS_PER_BATCH: 2,         // 2 sanity checks per batch
    BATCH_SIZE: 10,              // Every 10 videos
    MAX_FAILURES: 2              // Kick out after 2 wrong answers
  }
};
```

## Quiz Pair Pool

The system uses a pool of 40 quiz pairs (`ALL_QUIZ_PAIRS`):

| Worker Type | Initial Quiz | Sanity Check Pool |
|-------------|--------------|-------------------|
| Paid        | First 10 pairs (INITIAL_QUIZ_INDICES) | Remaining 30 pairs |
| Free        | None | All 40 pairs |

Sanity checks are randomly distributed: 2 checks randomly placed within each batch of 10 videos.

## Adding a New Policy

1. **Add videos**: Create `videos/newpolicy/` with `.mp4` files named by task
2. **Update generate.js**: Add the new policy directory
3. **Regenerate pairs**: Run `node scripts/generate.js`
4. **Update quiz config**: Use `quiz_pair_selector.html` to find and verify new quiz pairs
5. **Test locally**: Verify videos load and comparisons work

## Data Format

### Response Payload (v5.0)

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
    {"index": 100, "correct": true, "position": 5, "userAnswer": "left", "correctAnswer": "left"},
    {"index": 200, "correct": false, "position": 15, "userAnswer": "left", "correctAnswer": "right"}
  ],
  "sanity_checks_passed": 5,
  "sanity_checks_total": 6,
  "sanity_failures": 1,
  "failed": false,
  "failure_reason": null,
  "responses": [
    {
      "answer": "left_42",
      "description_A": "Robot grasped the cup successfully",
      "description_B": "Robot missed the cup entirely",
      "type": "regular"
    }
  ],
  "timestamp": "2024-12-08T10:30:00Z",
  "config_version": "v5.0"
}
```

### Response Types
- `"quiz"`: Initial qualification questions (paid workers only, with feedback)
- `"sanity_check"`: Hidden quality control questions (no feedback shown)
- `"regular"`: Normal comparison questions (used for ranking)

### Failure Reasons
- `"quiz_failed"`: Did not pass the initial quiz (< 80% correct)
- `"sanity_failed"`: Failed 2 or more sanity checks during main study

