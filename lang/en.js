/* 玲珑消 · lang/en.js — English strings */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  LL.LANG = LL.LANG || {};
  LL.LANG.en = {
    title: 'Linglong Match',
    subtitle: 'A  C H I N E S E  M A T C H - 3',
    play: 'Play',
    levels: 'Levels',
    settings: 'Settings',
    titleHint: 'Tap or drag two adjacent tiles to swap. Match 3 or more to clear.',
    loading: 'Preparing…',

    moves: 'Moves Left',
    score: 'Score',
    objectives: 'Objectives',
    objScore: 'Score',
    objCollect: 'Collect {name}',
    objClear: 'Clear all obstacles',
    objDone: 'Done',
    levelName: 'Level {n} · {name}',
    pause: 'Pause',
    soundOn: 'Sound on',
    soundOff: 'Sound off',

    selectLevel: 'Select Level',
    locked: 'Locked',
    continue: 'Continue',
    totalStars: '{n} stars',
    back: 'Back',

    paused: 'Paused',
    resume: 'Resume',
    retry: 'Retry',
    toMap: 'Level Map',
    next: 'Next Level',
    win: 'Level Clear!',
    lose: 'Out of Moves',
    finalScore: 'Score',
    bestScore: 'Best',
    newBest: 'New Best!',
    starGot: '{n} Stars',
    cascade: 'Combo ×{n}',
    keyPause: 'Pause',
    keyMute: 'Mute',
    keyRetry: 'Retry',
    keySpeed: 'Speed up',
    nice: 'Nice!',
    shuffle: 'No moves · Reshuffling',
    hurryNone: '',
    hint: 'Try here',

    winTips: ['Flawless and flowing', 'A perfect cascade', 'Grace in every move'],
    loseTips: ['One more try, one more insight', 'So close — again!', 'A fresh angle awaits'],

    volume: 'Volume',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    language: 'Language',
    resetProgress: 'Reset Progress',
    resetConfirm: 'Clear all level progress? This cannot be undone.',
    yes: 'Confirm',
    no: 'Cancel',
    close: 'Close',

    level: 'Level {n}',
    tapToStart: 'Tap anywhere to continue',
    specialWind: 'Wind Rune: clears a whole row or column',
    specialThunder: 'Thunder: blasts a 3×3 area',
    specialTaiji: 'Taiji: clears every tile of one color',
    obstFrost: 'Frost: clear the tile on it to break',
    obstStone: 'Stone Lock: needs two clears',
    obstVine: 'Vine: locks a tile, cannot be swapped'
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
