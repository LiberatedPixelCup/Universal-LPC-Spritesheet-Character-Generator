const fs = require('fs').promises; // Use promises-based fs for async operations
const path = require('path');
const { promisify } = require('util');
const exec = require('child_process').exec;
const execAsync = promisify(exec);

const currentBranch = 'full_rewrite';
const otherBranch = 'master';

// Function to get the content of a file from a specific branch
async function getFileContentFromBranch(branch, filePath) {
  try {
    const { stdout } = await execAsync(`git show ${branch}:${filePath}`);
    return JSON.parse(stdout);
  } catch (error) {
    // If the file doesn't exist on the other branch, return an empty object.
    if (error.message.includes('exists on disk, but not in')) {
      return {};
    }
    throw error;
  }
}

function restoreMissingKeys(target, source) {
  for (const key in source) {
    // Check if the key exists in the target but was removed.
    // If it's not present in the target, it's a removed key.
    if (!(key in target)) {
      target[key] = source[key];
    }
  }
  return target;
}

async function restoreKeysFromBranch(branchToCompare, filePath) {
  console.log(`Restoring missing keys from '${branchToCompare}' into '${filePath}'...`);

  try {
    // 1. Read the JSON file from the target branch.
    const sourceContent = await getFileContentFromBranch(branchToCompare, filePath);

    // 2. Read the local version of the JSON file.
    let targetContent = {};
    try {
      const targetFile = await fs.readFile(filePath, 'utf-8');
      targetContent = JSON.parse(targetFile);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    // 3. Restore any keys present in the source but missing in the target.
    const restoredContent = restoreMissingKeys(targetContent, sourceContent);
  
    return restoredContent;
  } catch (error) {
    console.error('Error during key restoration:', error);
  }
}


async function walkAndModifyJson(directoryPath, updateFunction) {
  try {
    const files = await fs.readdir(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        console.log(`Entering directory: ${filePath}`);
        await walkAndModifyJson(filePath, updateFunction); // Recurse into subdirectories
      } else if (stats.isFile() && path.extname(filePath) === '.json') {
        try {
          console.log(`Processing file: ${filePath}`);
          const fileContent = await fs.readFile(filePath, 'utf8');
          let jsonData = JSON.parse(fileContent);

          // Apply the update function to the JSON data
          jsonData = await updateFunction(jsonData, filePath); 

          // Write the updated JSON back to the file
          await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
          console.log(`Updated: ${filePath}`);
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
const startDirectory = './sheet_definitions'; // Replace with the actual directory path

// Define the update function to modify JSON data
// This function receives the parsed JSON object and the file path
// It should return the modified JSON object
const myUpdateFunction = async (data, filePath) => {
  const newData = await restoreKeysFromBranch(otherBranch, filePath);
  return newData;
};

// Call the function to start walking and modifying
walkAndModifyJson(startDirectory, myUpdateFunction)
  .then(() => console.log('Finished processing JSON files.'))
  .catch((err) => console.error('An error occurred during the process:', err));