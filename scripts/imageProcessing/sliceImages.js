const fs = require('fs');
const { execSync } = require('child_process');

const universalFrameSize = 64;

function cropToSubSheet(sheet, width, height, offsetX, offsetY, targetDir, sheetHeight, isMasterSheet) {
    if (offsetY >= sheetHeight) {
        return false;
    }
    const index = sheet.lastIndexOf('/');
    var directory = "";
    if (index > -1) {
        directory = sheet.substring(0, index);
    }
    if (directory == "") {
        throw Error(`Could not determine directory for ${sheet}`)
    }
    if (!isMasterSheet) {
        if (!fs.existsSync(`${directory}/${targetDir}`)) {
            execSync(`mkdir ${directory}/${targetDir}`, (err) => {
                if (err) {
                    throw err;
                }
            });
        }
    }
    
    var newFile = `${directory}/${targetDir}${sheet.substring(index)}`;
    if (isMasterSheet) {
        newFile = `${directory}/${targetDir.replace(/\/$/, "")}.png`;
    }
    execSync(`magick ${sheet} -crop ${width}x${height}+${offsetX}+${offsetY} ${newFile}`, (err) => {
        if (err) {
            throw err;
        }
    });
    return true;
}

function cropSheet(sheet, sheetHeight, isMasterSheet) {
    cropToSubSheet(sheet, 7*universalFrameSize, 4*universalFrameSize,0,0,"spellcast", sheetHeight, isMasterSheet);
    cropToSubSheet(sheet, 8*universalFrameSize, 4*universalFrameSize,0,4*universalFrameSize,"thrust", sheetHeight, isMasterSheet);
    cropToSubSheet(sheet, 9*universalFrameSize, 4*universalFrameSize,0,8*universalFrameSize,"walk", sheetHeight, isMasterSheet);
    cropToSubSheet(sheet, 6*universalFrameSize, 4*universalFrameSize,0,12*universalFrameSize,"slash", sheetHeight, isMasterSheet);
    cropToSubSheet(sheet, 13*universalFrameSize, 4*universalFrameSize,0,16*universalFrameSize,"shoot", sheetHeight, isMasterSheet);
    var result = cropToSubSheet(sheet, 6*universalFrameSize, universalFrameSize,0,20*universalFrameSize,"hurt", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 6*universalFrameSize, universalFrameSize,0,21*universalFrameSize,"climb", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 2*universalFrameSize, 4*universalFrameSize,0,22*universalFrameSize,"idle", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 2*universalFrameSize, 4*universalFrameSize,2*universalFrameSize,22*universalFrameSize,"combat_idle", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 4*universalFrameSize, 4*universalFrameSize,0,26*universalFrameSize,"jump", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 3*universalFrameSize, 4*universalFrameSize,0,30*universalFrameSize,"sit", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 3*universalFrameSize, 4*universalFrameSize,3*universalFrameSize,30*universalFrameSize,"emote", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 8*universalFrameSize, 4*universalFrameSize,0,34*universalFrameSize,"run", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 13*universalFrameSize, 4*universalFrameSize,0,38*universalFrameSize,"backslash", sheetHeight, isMasterSheet);
    if (!result) {
        return
    }
    result = cropToSubSheet(sheet, 6*universalFrameSize, 4*universalFrameSize,0,42*universalFrameSize,"halfslash", sheetHeight, isMasterSheet);
}

const walk = function(dir) {
    var results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.includes(".png")) {
                results.push(file);
            }
        }
    });
    return results;
}
const sheetsFolder = 'spritesheets/weapon';
const files = walk(sheetsFolder);

const masterSheetNames = [
    "female.png", 
    "male.png", 
    "muscular.png", 
    "child.png", 
    "pregnant.png", 
    "teen.png", 
    "adult.png", 
    "thin.png"
]
files.forEach(function(sheetToProcess) {
    console.log(`Start processing sheet: ${sheetToProcess}`);
    const index = sheetToProcess.lastIndexOf('/');
    var directory = "";
    if (index > -1) {
        directory = sheetToProcess.substring(0, index);
    }
    if (directory == "") {
        throw Error(`Could not determine directory for ${sheetToProcess}`)
    }
    const imageInfo = execSync(`magick identify -format "%w,%h" ${sheetToProcess}`, (err) => {
        if (err) {
            throw err;
        }
    });
    const widthAndHeight = String(imageInfo).split(",");
    const width = parseInt(widthAndHeight[0]);
    const height = parseInt(widthAndHeight[1]);
    var masterSheet = "";
    masterSheetNames.every(function(masterSheetName) {
        if (sheetToProcess.includes(masterSheetName)) {
            masterSheet = masterSheetName;
            return false;
        }
        return true;
    })
    if (width === 832 && height >= 1344) {
        var isMasterSheet = false;
        if (masterSheet !== "") {
            if (fs.existsSync(`${directory}/${masterSheet}`)) {
                execSync(`mv ${sheetToProcess} ${directory}/${masterSheet.replace(".png", "\/")}`, (err) => {
                    if (err) {
                        throw err;
                    }
                });
                sheetToProcess = `${directory}/${masterSheet.replace(".png", "\/")}${masterSheet}`;
                isMasterSheet = true;
            }
        }
        cropSheet(sheetToProcess, height, isMasterSheet);
        execSync(`rm ${sheetToProcess}`, (err) => {
            if (err) {
                throw err;
            }
        });
    }
});

