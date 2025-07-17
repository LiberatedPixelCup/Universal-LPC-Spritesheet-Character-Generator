// Use this script in order to recompose universal spritesheets from the separate animations.
// This script traverses all files inside `sheetsFolder` and concat the animations
// spellcast, thrust, walk ,slash, shoot, hurt into a new image file
// The new image can be found at the /universal folder of the asset with the variant name.  

const fs = require('fs');
const { execSync } = require('child_process');

const walk = function(dir) {
    var results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (file.endsWith("walk")) {
                results.push(file.replace("/walk",""));
            } else {
                results = results.concat(walk(file));
            }
        }
    });
    return results;
}
const sheetsFolder = 'spritesheets';
const walkDirectories = walk(sheetsFolder);
console.log("file", walkDirectories);

const masterSheetNames = [
    "spellcast", 
    "thrust", 
    "walk", 
    "slash", 
    "shoot", 
    "hurt"
]
walkDirectories.forEach(function(walkDirectory) {
    console.log(`Start processing sheet: ${walkDirectory}`);
    const list = fs.readdirSync(walkDirectory + "/walk");
    var variants = [];
    list.forEach(function(file) {
        if (file.includes(".png")) {
            variants.push(file);
        }
    });
    console.log("variants found", variants);

    const universalFolder = `${walkDirectory}/_universal`;
    if (fs.existsSync(universalFolder)) {
        fs.rmdirSync(universalFolder, { recursive: true, force: true })
    }
    fs.mkdirSync(universalFolder)
    variants.forEach(function(variant) {
        var imagesToCompose = [];
        masterSheetNames.forEach(function(animation) {
            const variantPath = `${walkDirectory}/${animation}/${variant}`
            if (fs.existsSync(`${walkDirectory}/${animation}/${variant}`)) {
                imagesToCompose.push(variantPath);
            } else {
                console.log("variantPath does NOT exist", variantPath)
                // TODO: Load a dummy here in order to preserve right sequence
            }
        });
        console.log("composing images", imagesToCompose);

        const newFile = `${universalFolder}/${variant}`;
        const inputArguments = imagesToCompose.join(" ");
        const command = `magick convert -background transparent -append ${inputArguments} ${newFile}`;
        execSync(command, (err) => {
            if (err) {
                throw err;
            }
        });
    });
});
