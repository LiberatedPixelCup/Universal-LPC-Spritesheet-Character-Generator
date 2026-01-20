// Palette Variants
export const PALETTE_VARIANTS = {
	"ulpc": {
		"label": "Universal LPC Generator"
	},
	"lpcr": {
		"label": "LPC Revised"
	}
};

// Palette Types Mapping
export const PALETTE_TYPES = {
	"body": {
        "label": "Skintone",
        "default": "ulpc",
        "base": "light",
    },
    "hair": {
        "label": "Hair",
        "default": "ulpc",
        "base": "orange"
    },
    "cloth": {
        "label": "Clothing",
        "default": "ulpc",
        "base": "brown"
    },
    "metal": {
        "label": "Metal",
        "default": "ulpc",
        "base": "steel"
    },
    "eye": {
        "label": "Eye Color",
        "default": "ulpc",
        "base": "blue"
    },
    "all": {
        "label": "All",
        "default": "ulpc",
        "base": "white"
    }
};

// Palettes Directory
const PALETTES_DIR = "palette_definitions/";

// Palette Files Mapping
export const PALETTE_FILES = {
	"body": {
        "ulpc": "ulpc_body",
        "lpcr": "lpcr_body"
    },
	"hair": {
        "ulpc": "ulpc_hair",
        "lpcr": "lpcr_hair"
    },
	"cloth": {
        "ulpc": "ulpc_cloth",
        "lpcr": "lpcr_cloth"
    },
	"metal": {
        "ulpc": "ulpc_metal",
        "lpcr": "lpcr_metal"
	},
	"eye": {
        "ulpc": "ulpc_eyes",
        "lpcr": "lpcr_eyes"
	},
	"all": {
        "lpcr": "lpcr_all"
	}
};


// Function to get Multiple Palettes from Recolors Config
export function getMultiPalettes(recolors) {
    // Check if Multiple Palettes Exist!
    const palettes = [];
    for (let paletteNum = 1; paletteNum < 10; paletteNum++) {
        // Check if this palette exists
        const colorKey = `color_${paletteNum}`;
        const color = recolors[colorKey];
        if (!color) break;

        // Push Palettes
        palettes.push(color);
    }

    // If No Multiple Palettes, Return Single Palette
    if (palettes.length === 0 && recolors.type) {
        palettes.push(recolors);
    }

    // Return Palettes
    return palettes;
}

// Function to get palette file info
export function getBasePalette(type, base = null) {
    // Check Palette Type Exists
    const typeData = PALETTE_TYPES[type];
    if (!typeData) {
        console.error(`Palette type not found: ${type}`);
        return null;
    }

    // Determine Base Variant
    let [variant, color] = base ? base.split(".") : [typeData.default, typeData.base];
    return color;

    // TO DO: Get EXACT Palette From File, it won't always be from the same palette variant!
}

// Get Single Palette File
export function getPaletteFile(type, palette) {
    // Get Alt Type if Exists
    let [trueType, variant] = palette.split(".");
    if (!variant) {
        variant = trueType;
        trueType = type;
    } else {
        fileData = PALETTE_FILES[trueType];
        if (!fileData) {
            console.error(`Alternate Palette Type does not exist: ${trueType}`);
            return null;
        }
    }

    // Variant Does Not Exist?!
    if (!fileData[variant]) {
        console.error(`Palette Variant does not exist for type ${trueType}: ${variant}`);
        return null;
    }

    // Return Palette File Data
    return {
        type: trueType,
        file: fileData[variant]
    };
}

// Get All Palette Files
export function getPaletteFiles(type, palettes) {
    // Get palette data for the specified type
    let fileData = PALETTE_FILES[type];
    if (!fileData) {
        console.error(`Palette Type does not exist: ${type}`);
        return null;
    }

    // Get List of Supported Palettes
    const paletteData = [];
    for (const palette of palettes) {
        const file = getPaletteFile(type, palette);
        if (file) {
            paletteData.push(file);
        }
    }
    return paletteData;
}