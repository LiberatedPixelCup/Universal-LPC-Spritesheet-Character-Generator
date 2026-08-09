import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PALETTE_ROOT = path.join(ROOT, "palette_definitions");

function parseArgs(argv) {
    const argMap = new Map();
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) {
            continue;
        }
        const [rawKey, rawValue] = token.split("=", 2);
        const key = rawKey.replace(/^--/, "");
        if (rawValue !== undefined) {
            argMap.set(key, rawValue);
            continue;
        }
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
            argMap.set(key, next);
            i += 1;
        } else {
            argMap.set(key, "true");
        }
    }
    return argMap;
}

function usageAndExit() {
    console.error(
        "Usage: node scripts/generate_all_palettes.js --variant <ulpc|lpcr|both> [--include-eye true|false]",
    );
    process.exit(1);
}

function normalizePalette(arr) {
    return arr.map((v) => String(v).toLowerCase());
}

function arraysEqualCaseInsensitive(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (String(a[i]).toLowerCase() !== String(b[i]).toLowerCase()) {
            return false;
        }
    }
    return true;
}

function listInputFiles(variant, includeEye) {
    const dirs = fs
        .readdirSync(PALETTE_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((d) => d !== "all")
        .filter((d) => includeEye || d !== "eye")
        .sort((a, b) => a.localeCompare(b));

    const suffix = `_${variant}.json`;
    const files = [];

    for (const dirName of dirs) {
        const dirPath = path.join(PALETTE_ROOT, dirName);
        const expectedName = `${dirName}${suffix}`;
        const filePath = path.join(dirPath, expectedName);
        if (fs.existsSync(filePath)) {
            files.push({
                sheet: dirName,
                relPath: path.join(dirName, expectedName),
                absPath: filePath,
            });
        }
    }

    return files;
}

function generateForVariant(variant, includeEye) {
    const inputFiles = listInputFiles(variant, includeEye);
    if (inputFiles.length === 0) {
        throw new Error(`No input files found for variant: ${variant}`);
    }

    const merged = {};
    const identicalDedupes = [];
    const conflictingDupes = [];
    const occurrencesByName = new Map();

    for (const info of inputFiles) {
        const raw = fs.readFileSync(info.absPath, "utf8");
        const parsed = JSON.parse(raw);

        for (const [paletteName, paletteValue] of Object.entries(parsed)) {
            const currentNormalized = normalizePalette(paletteValue);
            const list = occurrencesByName.get(paletteName) ?? [];
            list.push({
                sheet: info.sheet,
                sourcePath: info.relPath,
                value: currentNormalized,
            });
            occurrencesByName.set(paletteName, list);
        }
    }

    for (const [paletteName, occurrences] of occurrencesByName.entries()) {
        if (occurrences.length === 1) {
            merged[paletteName] = occurrences[0].value;
            continue;
        }

        const groups = [];
        for (const occ of occurrences) {
            const match = groups.find((g) => arraysEqualCaseInsensitive(g.value, occ.value));
            if (match) {
                match.items.push(occ);
            } else {
                groups.push({ value: occ.value, items: [occ] });
            }
        }

        if (groups.length === 1) {
            merged[paletteName] = groups[0].value;
            const kept = groups[0].items[0];
            for (let i = 1; i < groups[0].items.length; i += 1) {
                identicalDedupes.push({
                    palette: paletteName,
                    keptFrom: {
                        sheet: kept.sheet,
                        sourcePath: kept.sourcePath,
                    },
                    duplicateFrom: {
                        sheet: groups[0].items[i].sheet,
                        sourcePath: groups[0].items[i].sourcePath,
                    },
                });
            }
            continue;
        }

        for (const group of groups) {
            const representative = group.items[0];
            const prefixedName = `${representative.sheet}_${paletteName}`;
            if (prefixedName in merged && !arraysEqualCaseInsensitive(merged[prefixedName], representative.value)) {
                throw new Error(`Duplicate collision after prefixing for ${prefixedName}`);
            }
            merged[prefixedName] = representative.value;

            for (let i = 1; i < group.items.length; i += 1) {
                identicalDedupes.push({
                    palette: paletteName,
                    keptFrom: {
                        sheet: representative.sheet,
                        sourcePath: representative.sourcePath,
                    },
                    duplicateFrom: {
                        sheet: group.items[i].sheet,
                        sourcePath: group.items[i].sourcePath,
                    },
                });
            }
        }

        conflictingDupes.push({
            palette: paletteName,
            variant,
            renamedTo: groups.map((g) => `${g.items[0].sheet}_${paletteName}`),
            sources: groups.map((g) => g.items.map((i) => i.sourcePath)).flat(),
        });
    }

    const outPath = path.join(PALETTE_ROOT, "all", `all_${variant}.json`);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 4) + "\n");

    return {
        variant,
        includeEye,
        inputCount: inputFiles.length,
        outputCount: Object.keys(merged).length,
        outPath,
        identicalDedupes,
        conflictingDupes,
    };
}

function printSummary(result) {
    console.log(
        `Generated all_${result.variant}.json from ${result.inputCount} source sheets (includeEye=${result.includeEye}).`,
    );
    console.log(`Output palette count: ${result.outputCount}`);

    if (result.conflictingDupes.length > 0) {
        console.warn(`Warnings: ${result.conflictingDupes.length} conflicting duplicate name(s) were prefixed.`);
        for (const d of result.conflictingDupes) {
            console.warn(`  - ${d.palette}: ${d.renamedTo.join(", ")} [sources: ${d.sources.join(", ")}]`);
        }
    }

    if (result.identicalDedupes.length > 0) {
        console.log(`Identical duplicate names deduped: ${result.identicalDedupes.length}`);
        for (const d of result.identicalDedupes) {
            console.log(
                `  - ${d.palette}: kept ${d.keptFrom.sourcePath}, skipped identical from ${d.duplicateFrom.sourcePath}`,
            );
        }
    }
}

const args = parseArgs(process.argv.slice(2));
const variantArg = (args.get("variant") ?? "").toLowerCase();
if (!variantArg) {
    usageAndExit();
}
const includeEye = (args.get("include-eye") ?? "false").toLowerCase() === "true";

const variants =
    variantArg === "both" ? ["ulpc", "lpcr"] : [variantArg].filter((v) => v === "ulpc" || v === "lpcr");

if (variants.length === 0) {
    usageAndExit();
}

for (const variant of variants) {
    const result = generateForVariant(variant, includeEye);
    printSummary(result);
}
