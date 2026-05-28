const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_INPUT_DIR = path.join(ROOT, 'droid_videos', 'eval_videos_compressed');
const DEFAULT_TASK_MAP = path.join(ROOT, 'droid_videos', 'task_mapping.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'videos', 'droid_eval');
const DEFAULT_OUTPUT_PAIRS = path.join(ROOT, 'videos', 'pairs_droid.json');
const DEFAULT_SPEED = 4;
const DEFAULT_PAIR_MODE = 'all';
const REQUIRED_VIDEOS_PER_SCENE = 9;
const DEFAULT_EXCLUDED_SCENES = new Set(['droid26']);
const FILENAME_PATTERN = /^(droid\d+)_([0-9]{8}_[0-9]{6})_franka_ep(\d+)_([^_]+)_([^_]+)_main_preview\.mp4$/;

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    taskMapPath: DEFAULT_TASK_MAP,
    outputDir: DEFAULT_OUTPUT_DIR,
    outputPairs: DEFAULT_OUTPUT_PAIRS,
    speed: DEFAULT_SPEED,
    pairMode: DEFAULT_PAIR_MODE,
    noTranscode: false,
    overwrite: false,
    limitPairsPerScene: null,
    includeSelfComparisons: true,
    requiredVideosPerScene: REQUIRED_VIDEOS_PER_SCENE,
    excludedScenes: new Set(DEFAULT_EXCLUDED_SCENES),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input-dir') options.inputDir = path.resolve(argv[++i]);
    else if (arg === '--task-map') options.taskMapPath = path.resolve(argv[++i]);
    else if (arg === '--output-dir') options.outputDir = path.resolve(argv[++i]);
    else if (arg === '--output-pairs') options.outputPairs = path.resolve(argv[++i]);
    else if (arg === '--speed') options.speed = Number(argv[++i]);
    else if (arg === '--pair-mode') options.pairMode = argv[++i];
    else if (arg === '--limit-pairs-per-scene') options.limitPairsPerScene = Number(argv[++i]);
    else if (arg === '--required-videos-per-scene') options.requiredVideosPerScene = Number(argv[++i]);
    else if (arg === '--exclude-scenes') {
      options.excludedScenes = new Set(
        argv[++i]
          .split(',')
          .map(value => value.trim())
          .filter(Boolean)
      );
    }
    else if (arg === '--include-droid26') options.excludedScenes.delete('droid26');
    else if (arg === '--no-self-comparisons') options.includeSelfComparisons = false;
    else if (arg === '--no-transcode') options.noTranscode = true;
    else if (arg === '--overwrite') options.overwrite = true;
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.speed) || options.speed <= 0) {
    throw new Error('--speed must be a positive number');
  }

  if (!['all', 'cross-policy-only'].includes(options.pairMode)) {
    throw new Error('--pair-mode must be one of: all, cross-policy-only');
  }

  if (options.limitPairsPerScene !== null && (!Number.isInteger(options.limitPairsPerScene) || options.limitPairsPerScene <= 0)) {
    throw new Error('--limit-pairs-per-scene must be a positive integer');
  }

  if (!Number.isInteger(options.requiredVideosPerScene) || options.requiredVideosPerScene <= 0) {
    throw new Error('--required-videos-per-scene must be a positive integer');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/prepare_droid_videos.js [options]

Options:
  --input-dir <path>             Flat folder containing raw DROID mp4 files
  --task-map <path>              JSON mapping scene ids to human-readable task names
  --output-dir <path>            Where sped-up copies will be written
  --output-pairs <path>          Output pairs JSON file
  --speed <number>               Video playback speed multiplier (default: ${DEFAULT_SPEED})
  --pair-mode <mode>             all | cross-policy-only (default: ${DEFAULT_PAIR_MODE})
  --limit-pairs-per-scene <n>    Randomly keep at most n pairs per scene
  --required-videos-per-scene <n>  Only keep scenes with exactly n videos (default: ${REQUIRED_VIDEOS_PER_SCENE})
  --exclude-scenes <a,b,...>     Exclude specific scene ids (default excludes: ${Array.from(DEFAULT_EXCLUDED_SCENES).join(', ')})
  --include-droid26              Re-include droid26 if needed
  --no-self-comparisons          Exclude same-model different-rollout comparisons
  --no-transcode                 Reuse original files instead of writing sped-up copies
  --overwrite                    Re-encode outputs even if target file already exists
  --help                         Show this message
`);
}

function loadTaskMap(taskMapPath) {
  if (!fs.existsSync(taskMapPath)) return {};
  return JSON.parse(fs.readFileSync(taskMapPath, 'utf8'));
}

function listVideos(inputDir) {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  return fs.readdirSync(inputDir)
    .filter(name => name.endsWith('.mp4'))
    .sort();
}

function inferRolloutIndex(sortedEntriesForScene) {
  const counters = new Map();

  for (const entry of sortedEntriesForScene) {
    const current = counters.get(entry.model) || 0;
    counters.set(entry.model, current + 1);
    entry.rolloutIndex = current + 1;
  }
}

function buildManifest(files, inputDir, taskMap) {
  const parsed = [];
  const unmatched = [];

  for (const file of files) {
    const match = file.match(FILENAME_PATTERN);
    if (!match) {
      unmatched.push(file);
      continue;
    }

    const [, sceneId, timestamp, episode, model, result] = match;
    parsed.push({
      file,
      absoluteInputPath: path.join(inputDir, file),
      sceneId,
      timestamp,
      episode,
      model,
      result,
      task: taskMap[sceneId] || sceneId,
    });
  }

  const byScene = new Map();
  for (const entry of parsed) {
    if (!byScene.has(entry.sceneId)) byScene.set(entry.sceneId, []);
    byScene.get(entry.sceneId).push(entry);
  }

  for (const sceneEntries of byScene.values()) {
    sceneEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.model.localeCompare(b.model));
    inferRolloutIndex(sceneEntries);
    for (const entry of sceneEntries) {
      entry.policyId = `${entry.model}_rollout${entry.rolloutIndex}`;
      entry.displaySource = `${entry.model} rollout ${entry.rolloutIndex}`;
      entry.instruction = `droid_${entry.task}_${entry.sceneId}`;
    }
  }

  return { entries: parsed, unmatched, byScene };
}

function filterCompleteScenes(byScene, requiredVideosPerScene) {
  const kept = new Map();
  const dropped = [];

  for (const [sceneId, sceneEntries] of byScene.entries()) {
    if (sceneEntries.length === requiredVideosPerScene) {
      kept.set(sceneId, sceneEntries);
    } else {
      dropped.push({ sceneId, count: sceneEntries.length });
    }
  }

  return { kept, dropped };
}

function excludeScenes(byScene, excludedScenes) {
  const kept = new Map();
  const dropped = [];

  for (const [sceneId, sceneEntries] of byScene.entries()) {
    if (excludedScenes.has(sceneId)) {
      dropped.push({ sceneId, count: sceneEntries.length, reason: 'excluded' });
      continue;
    }

    kept.set(sceneId, sceneEntries);
  }

  return { kept, dropped };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runFfmpeg(inputPath, outputPath, speed) {
  const videoFilter = `setpts=PTS/${speed}`;
  const audioFilter = buildAtempoFilter(speed);
  const args = [
    '-y',
    '-i', inputPath,
    '-filter:v', videoFilter,
  ];

  if (audioFilter) {
    args.push('-filter:a', audioFilter);
  } else {
    args.push('-an');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-movflags', '+faststart',
    outputPath,
  );

  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${inputPath}`);
  }
}

function buildAtempoFilter(speed) {
  if (speed <= 0) return null;
  const factors = [];
  let remaining = speed;

  while (remaining > 2.0) {
    factors.push(2.0);
    remaining /= 2.0;
  }

  while (remaining < 0.5) {
    factors.push(0.5);
    remaining /= 0.5;
  }

  factors.push(Number(remaining.toFixed(6)));
  return factors.map(value => `atempo=${value}`).join(',');
}

function materializeVideos(entries, options) {
  const prepared = [];
  if (!options.noTranscode) {
    ensureDir(options.outputDir);
  }

  for (const entry of entries) {
    if (options.noTranscode) {
      prepared.push({
        ...entry,
        relativePath: path.relative(ROOT, entry.absoluteInputPath).split(path.sep).join('/'),
      });
      continue;
    }

    const outputFile = `${path.basename(entry.file, '.mp4')}_x${String(options.speed).replace('.', 'p')}.mp4`;
    const absoluteOutputPath = path.join(options.outputDir, outputFile);
    const relativePath = path.relative(ROOT, absoluteOutputPath).split(path.sep).join('/');

    if (!fs.existsSync(absoluteOutputPath) || options.overwrite) {
      console.log(`Transcoding ${entry.file} -> ${outputFile}`);
      runFfmpeg(entry.absoluteInputPath, absoluteOutputPath, options.speed);
    }

    prepared.push({
      ...entry,
      absoluteOutputPath,
      relativePath,
    });
  }

  return prepared;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generatePairs(byScene, options) {
  const pairs = [];

  for (const sceneEntries of byScene.values()) {
    const localPairs = [];

    for (let i = 0; i < sceneEntries.length; i++) {
      for (let j = i + 1; j < sceneEntries.length; j++) {
        const left = sceneEntries[i];
        const right = sceneEntries[j];

        if (!options.includeSelfComparisons && left.model === right.model) {
          continue;
        }

        if (options.pairMode === 'cross-policy-only' && left.model === right.model) {
          continue;
        }

        localPairs.push({
          instruction: left.instruction,
          scene_id: left.sceneId,
          task: left.task,
          videoA: {
            path: left.relativePath,
            source: left.displaySource,
            model: left.model,
            rollout: left.rolloutIndex,
            policy_id: left.policyId,
            timestamp: left.timestamp,
          },
          videoB: {
            path: right.relativePath,
            source: right.displaySource,
            model: right.model,
            rollout: right.rolloutIndex,
            policy_id: right.policyId,
            timestamp: right.timestamp,
          },
          comparison_type: left.model === right.model ? 'intra-policy' : 'inter-policy',
        });
      }
    }

    if (options.limitPairsPerScene && localPairs.length > options.limitPairsPerScene) {
      shuffleInPlace(localPairs);
      pairs.push(...localPairs.slice(0, options.limitPairsPerScene));
    } else {
      pairs.push(...localPairs);
    }
  }

  return pairs;
}

function summarize(entries, unmatched, pairs, droppedScenes, excludedScenes) {
  const byModel = {};
  const byScene = {};
  const byComparisonType = {};

  for (const entry of entries) {
    byModel[entry.model] = (byModel[entry.model] || 0) + 1;
    byScene[entry.sceneId] = (byScene[entry.sceneId] || 0) + 1;
  }

  for (const pair of pairs) {
    byComparisonType[pair.comparison_type] = (byComparisonType[pair.comparison_type] || 0) + 1;
  }

  const sceneSummary = Object.entries(byScene)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sceneId, count]) => `${sceneId}:${count}`)
    .join(', ');

  console.log(`Parsed videos: ${entries.length}`);
  console.log(`Unmatched filenames: ${unmatched.length}`);
  console.log(`Pairs generated: ${pairs.length}`);
  console.log(`Videos by model: ${JSON.stringify(byModel)}`);
  console.log(`Pairs by type: ${JSON.stringify(byComparisonType)}`);
  console.log(`Excluded scenes: ${Array.from(excludedScenes).join(', ') || 'none'}`);
  console.log(`Scene counts: ${sceneSummary}`);
  console.log(`Dropped scenes: ${droppedScenes.length}`);
  if (droppedScenes.length > 0) {
    console.log(`Dropped scene details: ${droppedScenes.map(item => `${item.sceneId}:${item.count}`).join(', ')}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const taskMap = loadTaskMap(options.taskMapPath);
  const files = listVideos(options.inputDir);
  const { entries, unmatched, byScene } = buildManifest(files, options.inputDir, taskMap);
  const { kept: allowedScenes, dropped: excludedDropped } = excludeScenes(byScene, options.excludedScenes);
  const { kept: completeScenes, dropped: incompleteDropped } = filterCompleteScenes(allowedScenes, options.requiredVideosPerScene);
  const droppedScenes = [...excludedDropped, ...incompleteDropped];
  const filteredEntries = Array.from(completeScenes.values()).flat();
  const preparedEntries = materializeVideos(filteredEntries, options);

  const preparedByScene = new Map();
  for (const entry of preparedEntries) {
    if (!preparedByScene.has(entry.sceneId)) preparedByScene.set(entry.sceneId, []);
    preparedByScene.get(entry.sceneId).push(entry);
  }

  for (const sceneEntries of preparedByScene.values()) {
    sceneEntries.sort((a, b) => a.model.localeCompare(b.model) || a.rolloutIndex - b.rolloutIndex);
  }

  const pairs = generatePairs(preparedByScene, options);
  ensureDir(path.dirname(options.outputPairs));
  fs.writeFileSync(options.outputPairs, JSON.stringify(pairs, null, 2));

  summarize(preparedEntries, unmatched, pairs, droppedScenes, options.excludedScenes);
  console.log(`Wrote pairs to ${options.outputPairs}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
