import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import { debugLog } from "./utils/debug.ts";

const execAsync = promisify(exec);

const otherBranch = "master";

type JsonObject = Record<string, unknown>;

type UpdateFunction = (
  data: JsonObject,
  filePath: string,
) => Promise<JsonObject | undefined>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Function to get the content of a file from a specific branch
async function getFileContentFromBranch(
  branch: string,
  filePath: string,
): Promise<JsonObject> {
  try {
    const { stdout } = await execAsync(`git show ${branch}:${filePath}`);
    return JSON.parse(stdout) as JsonObject;
  } catch (error) {
    // If the file doesn't exist on the other branch, return an empty object.
    if (errorMessage(error).includes("exists on disk, but not in")) {
      return {};
    }
    throw error;
  }
}

function restoreMissingKeys(
  target: JsonObject,
  source: JsonObject,
): JsonObject {
  for (const key in source) {
    // Check if the key exists in the target but was removed.
    // If it's not present in the target, it's a removed key.
    if (!(key in target)) {
      target[key] = source[key];
    }
  }
  return target;
}

async function restoreKeysFromBranch(
  branchToCompare: string,
  filePath: string,
): Promise<JsonObject | undefined> {
  debugLog(
    `Restoring missing keys from '${branchToCompare}' into '${filePath}'...`,
  );

  try {
    // 1. Read the JSON file from the target branch.
    const sourceContent = await getFileContentFromBranch(
      branchToCompare,
      filePath,
    );

    // 2. Read the local version of the JSON file.
    let targetContent: JsonObject = {};
    try {
      const targetFile = await fs.readFile(filePath, "utf-8");
      targetContent = JSON.parse(targetFile) as JsonObject;
    } catch (err) {
      if (!(
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      )) {
        throw err;
      }
    }

    // 3. Restore any keys present in the source but missing in the target.
    const restoredContent = restoreMissingKeys(targetContent, sourceContent);

    return restoredContent;
  } catch (error) {
    console.error("Error during key restoration:", error);
    return undefined;
  }
}

async function walkAndModifyJson(
  directoryPath: string,
  updateFunction: UpdateFunction,
): Promise<void> {
  try {
    const files = await fs.readdir(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        debugLog(`Entering directory: ${filePath}`);
        await walkAndModifyJson(filePath, updateFunction); // Recurse into subdirectories
      } else if (stats.isFile() && path.extname(filePath) === ".json") {
        try {
          debugLog(`Processing file: ${filePath}`);
          const fileContent = await fs.readFile(filePath, "utf8");
          let jsonData: JsonObject | undefined = JSON.parse(
            fileContent,
          ) as JsonObject;

          // Apply the update function to the JSON data
          jsonData = await updateFunction(jsonData, filePath);

          // Write the updated JSON back to the file
          await fs.writeFile(
            filePath,
            JSON.stringify(jsonData, null, 2),
            "utf8",
          );
          debugLog(`Updated: ${filePath}`);
        } catch (jsonError) {
          console.error(`Error processing JSON file ${filePath}:`, jsonError);
        }
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${directoryPath}:`, err);
  }
}

// Example usage:
// Define the directory to start walking from
const startDirectory = "./sheet_definitions"; // Replace with the actual directory path

// Define the update function to modify JSON data
// This function receives the parsed JSON object and the file path
// It should return the modified JSON object
const myUpdateFunction: UpdateFunction = async (_data, filePath) => {
  const newData = await restoreKeysFromBranch(otherBranch, filePath);
  return newData;
};

// Call the function to start walking and modifying
walkAndModifyJson(startDirectory, myUpdateFunction)
  .then(() => debugLog("Finished processing JSON files."))
  .catch((err: unknown) =>
    console.error("An error occurred during the process:", err),
  );
