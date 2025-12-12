const fs = require('fs');
const path = require('path');

const VIDEO_ROOT = path.join(__dirname, '../videos');
const EXCLUDED_DIR = 'real';
const OUTPUT_FILE = path.join(VIDEO_ROOT, 'pairs.json');
const NUM_VIDEOS = 6; // Set number of videos per task here

function collectVideos() {
  const dirs = fs.readdirSync(VIDEO_ROOT).filter(d =>
    fs.statSync(path.join(VIDEO_ROOT, d)).isDirectory() && d !== EXCLUDED_DIR
  );

  const taskMap = {};

  for (const dir of dirs) {
    const files = fs.readdirSync(path.join(VIDEO_ROOT, dir));
    for (const file of files) {
      if (!file.endsWith('.mp4')) continue;

      const taskName = path.basename(file, '.mp4'); // e.g. test_open_drawer_1
      if (!taskMap[taskName]) taskMap[taskName] = [];

      taskMap[taskName].push({
        path: `videos/${dir}/${file}`,
        source: dir
      });
    }
  }

  return taskMap;
}

function getRandomPairs(arr, numPairs) {
    const combinations = [];
    // Generate all pairwise combinations
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        combinations.push([arr[i], arr[j]]);
      }
    }
  
    // Randomly shuffle combinations
    for (let i = combinations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combinations[i], combinations[j]] = [combinations[j], combinations[i]];
    }
  
    // Return first numPairs combinations (or all if numPairs is null/undefined)
    return numPairs ? combinations.slice(0, numPairs) : combinations;
}
  
// Main function
function generateRandomTaskPairs(taskMap, numVideos, numPairs = null) {
    const finalPairs = [];
  
    for (const [taskName, videos] of Object.entries(taskMap)) {
      if (videos.length !== numVideos) continue; // Only process tasks with exact number of videos
  
      const randomPairs = getRandomPairs(videos, numPairs);
      for (const [videoA, videoB] of randomPairs) {
        finalPairs.push({
          instruction: taskName,
          videoA,
          videoB
        });
      }
    }
  
    return finalPairs;
}

function main() {
  const taskMap = collectVideos();
  // Generate all possible pairs for tasks with NUM_VIDEOS videos
  // Pass a number as 3rd argument to limit pairs per task (e.g., generateRandomTaskPairs(taskMap, NUM_VIDEOS, 8))
  const pairs = generateRandomTaskPairs(taskMap, NUM_VIDEOS);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pairs, null, 2));
  console.log(`✅ Generated ${pairs.length} pairs at ${OUTPUT_FILE}`);
}

main();