// Script to locate old quiz pairs in the new pairs.json
// Run this in Node.js: node find-quiz-pairs.js

const fs = require('fs');
const path = require('path');

// Original quiz configuration from videos.html
const oldQuizIndices = {
    1: { correct_answer: 'left'},
    7: { correct_answer: 'same'},
    22: { correct_answer: 'left'},
    360: { correct_answer: 'right'},
    420: { correct_answer: 'left'},
    1099: { correct_answer: 'left'},
    1653: { correct_answer: 'left' },
    3092: { correct_answer: 'right'},
    3200: { correct_answer: 'left'},
    3700: { correct_answer: 'same'}
};

function findQuizPairs() {
    // Load both files
    const pairsOld = JSON.parse(fs.readFileSync('./videos/pairs_old.json', 'utf8'));
    const pairsNew = JSON.parse(fs.readFileSync('./videos/pairs.json', 'utf8'));

    console.log('\n=== SEARCHING FOR OLD QUIZ PAIRS IN NEW PAIRS.JSON ===\n');

    // Extract old quiz pairs
    const oldQuizPairs = Object.keys(oldQuizIndices).map(idx => {
        const pair = pairsOld[idx];
        return {
        oldIndex: idx,
        correctAnswer: oldQuizIndices[idx].correct_answer,
        instruction: pair.instruction,
        videoA: pair.videoA,
        videoB: pair.videoB
        };
    });

    console.log('Old Quiz Pairs:\n');
    oldQuizPairs.forEach(quiz => {
        console.log(`Index ${quiz.oldIndex} (correct: ${quiz.correctAnswer}):`);
        console.log(`  Task: ${quiz.instruction}`);
        console.log(`  Video A: ${quiz.videoA.source} - ${quiz.videoA.path}`);
        console.log(`  Video B: ${quiz.videoB.source} - ${quiz.videoB.path}`);
        console.log('');
    });

  // Search for matches in new pairs.json
    console.log('\n=== MATCHES FOUND IN NEW PAIRS.JSON ===\n');
    
    const matches = [];
    oldQuizPairs.forEach(oldQuiz => {
        const foundIndex = pairsNew.findIndex(newPair => 
        newPair.instruction === oldQuiz.instruction &&
        newPair.videoA.path === oldQuiz.videoA.path &&
        newPair.videoB.path === oldQuiz.videoB.path
        );

    if (foundIndex !== -1) {
        console.log(`✅ FOUND: Old index ${oldQuiz.oldIndex} → New index ${foundIndex}`);
        console.log(`   Task: ${oldQuiz.instruction}`);
        console.log(`   Correct answer: ${oldQuiz.correctAnswer}`);
        console.log('');
        matches.push({
            newIndex: foundIndex,
            oldIndex: oldQuiz.oldIndex,
            correctAnswer: oldQuiz.correctAnswer,
            instruction: oldQuiz.instruction
        });
        } else {
        console.log(`❌ NOT FOUND: Old index ${oldQuiz.oldIndex}`);
        console.log(`   Task: ${oldQuiz.instruction}`);
        console.log(`   This pair no longer exists in the new pairs.json`);
        console.log('');
        }
    });

    // Generate new quizConfig object
    if (matches.length > 0) {
        console.log('\n=== NEW QUIZ CONFIG FOR videos.html ===\n');
        console.log('// Paid Workers Quiz (first 5):');
        const paidQuiz = {};
        matches.slice(0, 5).forEach(m => {
        paidQuiz[m.newIndex] = { correct_answer: m.correctAnswer };
        });
        console.log('const paidWorkerQuizConfig = ' + JSON.stringify(paidQuiz, null, 2) + ';\n');

        console.log('// Sanity Check Pairs (all 10):');
        const sanityCheck = {};
        matches.forEach(m => {
        sanityCheck[m.newIndex] = { correct_answer: m.correctAnswer };
        });
        console.log('const sanityCheckConfig = ' + JSON.stringify(sanityCheck, null, 2) + ';');
    }

    // Summary
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total old quiz pairs: ${oldQuizPairs.length}`);
    console.log(`Matches found in new pairs.json: ${matches.length}`);
    console.log(`Missing pairs: ${oldQuizPairs.length - matches.length}`);

    if (matches.length < 10) {
        console.log('\n⚠️  WARNING: Not all quiz pairs were found!');
        console.log('You may need to manually select new sanity check pairs.');
    }

    return matches;
    }

    // Run the script
    try {
    findQuizPairs();
    } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure pairs.json and pairs_old.json exist in the videos/ directory.');
    }