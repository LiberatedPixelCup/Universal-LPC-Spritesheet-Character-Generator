// Constants used throughout the application
export const FRAME_SIZE = 64; // Size of each frame in the spritesheet

// License configuration - single source of truth
export const LICENSE_CONFIG = [
	{
		key: "CC0",
		label: "CC0",
		versions: ["CC0"],
		url: "https://creativecommons.org/public-domain/cc0/"
	},
	{
		key: "CC-BY-SA",
		label: "CC-BY-SA",
		versions: ["CC-BY-SA 3.0", "CC-BY-SA 4.0"],
		url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
		urlLabel: "4.0"
	},
	{
		key: "CC-BY",
		label: "CC-BY",
		versions: ["CC-BY 3.0+", "CC-BY 3.0", "CC-BY 4.0", "CC-BY"],
		url: "https://creativecommons.org/licenses/by/4.0/",
		urlLabel: "4.0"
	},
	{
		key: "OGA-BY",
		label: "OGA-BY",
		versions: ["OGA-BY 3.0", "OGA-BY 3.0+", "OGA-BY 4.0"],
		url: "https://static.opengameart.org/OGA-BY-3.0.txt",
		urlLabel: "3.0"
	},
	{
		key: "GPL",
		label: "GPL",
		versions: ["GPL 2.0", "GPL 3.0"],
		url: "https://www.gnu.org/licenses/gpl-3.0.en.html#license-text",
		urlLabel: "3.0"
	}
];

// Animation list - used for filters and preview
export const ANIMATIONS = [
	{ value: 'spellcast', label: 'Spellcast' },
	{ value: 'thrust', label: 'Thrust' },
	{ value: 'walk', label: 'Walk' },
	{ value: 'slash', label: 'Slash' },
	{ value: 'shoot', label: 'Shoot' },
	{ value: 'hurt', label: 'Hurt' },
	{ value: 'climb', label: 'Climb' },
	{ value: 'idle', label: 'Idle' },
	{ value: 'jump', label: 'Jump' },
	{ value: 'sit', label: 'Sit' },
	{ value: 'emote', label: 'Emote' },
	{ value: 'run', label: 'Run' },
	{ value: 'watering', label: 'Watering', noExport: true },
	{ value: 'combat', label: 'Combat Idle', folderName: 'combat_idle' },
	{ value: '1h_slash', label: '1-Handed Slash', folderName: 'backslash', noExport: true },
	{ value: '1h_backslash', label: '1-Handed Backslash', folderName: 'backslash'},
	{ value: '1h_halfslash', label: '1-Handed Halfslash', folderName: 'halfslash' }
];

// Animation offsets (y-positions on spritesheet) - matches chargen.js base_animations
export const ANIMATION_OFFSETS = {
  spellcast: 0,
  thrust: 4 * FRAME_SIZE,
  walk: 8 * FRAME_SIZE,
  slash: 12 * FRAME_SIZE,
  shoot: 16 * FRAME_SIZE,
  hurt: 20 * FRAME_SIZE,
  climb: 21 * FRAME_SIZE,
  idle: 22 * FRAME_SIZE,
  jump: 26 * FRAME_SIZE,
  sit: 30 * FRAME_SIZE,
  emote: 34 * FRAME_SIZE,
  run: 38 * FRAME_SIZE,
  combat_idle: 42 * FRAME_SIZE,
  backslash: 46 * FRAME_SIZE,
  halfslash: 50 * FRAME_SIZE
};

// Animation definitions with frame cycles
export const ANIMATION_CONFIGS = {
  'spellcast': { row: 0, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6] },
  'thrust': { row: 4, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7] },
  'walk': { row: 8, num: 4, cycle: [1, 2, 3, 4, 5, 6, 7, 8] },
  'slash': { row: 12, num: 4, cycle: [0, 1, 2, 3, 4, 5] },
  'shoot': { row: 16, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  'hurt': { row: 20, num: 1, cycle: [0, 1, 2, 3, 4, 5] },
  'climb': { row: 21, num: 1, cycle: [0, 1, 2, 3, 4, 5] },
  'idle': { row: 22, num: 4, cycle: [0, 0, 1] },
  'jump': { row: 26, num: 4, cycle: [0, 1, 2, 3, 4, 1] },
  'sit': { row: 30, num: 4, cycle: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2] },
  'emote': { row: 34, num: 4, cycle: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2] },
  'run': { row: 38, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7] },
  'watering': { row: 4, num: 4, cycle: [0, 1, 4, 4, 4, 4, 5] },
  'combat': { row: 42, num: 4, cycle: [0, 0, 1] },
  '1h_slash': { row: 46, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6] },
  '1h_backslash': { row: 46, num: 4, cycle: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12] },
  '1h_halfslash': { row: 50, num: 4, cycle: [0, 1, 2, 3, 4, 5] }
};