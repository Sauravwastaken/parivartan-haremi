const vscode = require('vscode');
const path = require('path');

/**
 * Validate image tags in the document
 * @param {vscode.TextDocument} document 
 * @param {vscode.Diagnostic[]} diagnostics 
 */
function validate(document, diagnostics) {
    const text = document.getText();
    
    // Extract filename without extension
    const fileName = path.parse(document.fileName).name;
    const expectedFolderName = `${fileName}_files`;
    
    // Find all correctly formatted image tags
    const images = findAllImages(text);
    
    // Find potential typo errors in image tags
    findImageTagTypos(document, text, images, diagnostics);
    
    // If no images found, no further validation needed
    if (images.length === 0) {
        return;
    }
    
    // Check folder naming pattern
    validateFolderNames(document, images, expectedFolderName, diagnostics);
    
    // Check image numbering
    validateImageNumbering(document, images, diagnostics);
}

/**
 * Find all image tags in the document
 * @param {string} text 
 * @returns {Array<{fullMatch: string, src: string, index: number}>}
 */
function findAllImages(text) {
    // Find correctly formatted img tags with src attribute
    const regex = /<img\s+[^>]*?src="([^"]*)"[^>]*>/gi;
    const images = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const srcAttr = match[1];
        images.push({
            fullMatch: match[0],
            src: srcAttr,
            index: match.index
        });
    }
    
    // Also check for 'sc' attribute as a common error
    const scRegex = /<img\s+[^>]*?sc="([^"]*)"[^>]*>/gi;
    while ((match = scRegex.exec(text)) !== null) {
        const srcAttr = match[1];
        images.push({
            fullMatch: match[0],
            src: srcAttr,
            index: match.index,
            hasScAttribute: true
        });
    }
    
    return images;
}

/**
 * Find potential typos in image tags (like <im> instead of <img>)
 * @param {vscode.TextDocument} document
 * @param {string} text
 * @param {Array} images Already found correct image tags
 * @param {vscode.Diagnostic[]} diagnostics
 */
function findImageTagTypos(document, text, images, diagnostics) {
    // Find all occurrences of "_files/" that might indicate image references
    const filesRegex = /(\w+)_files\/(\d+)\.png/gi;
    let match;
    const filesMatches = new Set();
    
    while ((match = filesRegex.exec(text)) !== null) {
        const filePath = match[0];
        filesMatches.add(filePath);
    }
    
    // If no _files references found, no typos to check
    if (filesMatches.size === 0) {
        return;
    }
    
    // Check if each _files reference exists in a properly formatted img tag
    filesMatches.forEach(filePath => {
        // Check if this path exists in any of the correctly found images
        const foundInCorrectTag = images.some(img => img.src.includes(filePath));
        
        if (!foundInCorrectTag) {
            // This file path is not in a correctly formatted img tag
            // Look for it in the document with surrounding context
            const filePathIndex = text.indexOf(filePath);
            
            if (filePathIndex > -1) {
                // Look for potential malformed img tags around this filepath
                const startSearchIndex = Math.max(0, filePathIndex - 50);
                const endSearchIndex = Math.min(text.length, filePathIndex + filePath.length + 50);
                const contextText = text.substring(startSearchIndex, endSearchIndex);
                
                // Check for common typos in image tags
                const typoMatches = [
                    /<im\s+[^>]*?(?:src|sc)="[^"]*"/i, // <im> instead of <img>
                    /<imge\s+[^>]*?(?:src|sc)="[^"]*"/i, // <imge> instead of <img>
                    /<image\s+[^>]*?(?:src|sc)="[^"]*"/i, // <image> instead of <img>
                    /<i mg\s+[^>]*?(?:src|sc)="[^"]*"/i, // Space between i and mg
                    /<\s*img[^>]*?(?:s|sr|rc|scr)="[^"]*"/i // Typo in src attribute
                ];
                
                for (const typoRegex of typoMatches) {
                    const typoMatch = typoRegex.exec(contextText);
                    if (typoMatch) {
                        // Found a potential typo
                        const typoTagPosition = startSearchIndex + typoMatch.index;
                        const typoTagEndPosition = typoTagPosition + typoMatch[0].length;
                        
                        // Get the range for the diagnostic
                        const range = new vscode.Range(
                            document.positionAt(typoTagPosition),
                            document.positionAt(typoTagEndPosition)
                        );
                        
                        // Create diagnostic
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Possible typo in image tag. Should be <img src="${filePath}">`,
                            vscode.DiagnosticSeverity.Error
                        );
                        
                        diagnostic.source = 'Educational Validator';
                        
                        // Suggest a fix
                        const correctTag = `<img src="${filePath}">`;
                        diagnostic.code = {
                            value: 'fix-image-tag-typo',
                            target: vscode.Uri.parse(`command:educational-validator.fixIssue?${encodeURIComponent(JSON.stringify([
                                document.uri.toString(),
                                range,
                                correctTag
                            ]))}`)
                        };
                        
                        diagnostics.push(diagnostic);
                        break;
                    }
                }
                
                // If no specific typo found but we know there's likely a problem
                if (!diagnostics.some(d => d.range.contains(document.positionAt(filePathIndex)))) {
                    // Create a more general diagnostic around the filepath
                    const range = new vscode.Range(
                        document.positionAt(filePathIndex - 5),
                        document.positionAt(filePathIndex + filePath.length + 5)
                    );
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `File path found outside a proper <img> tag. Check for HTML syntax errors.`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    
                    diagnostic.source = 'Educational Validator';
                    diagnostics.push(diagnostic);
                }
            }
        }
    });
}

/**
 * Validate that image folder names match expected pattern
 * @param {vscode.TextDocument} document 
 * @param {Array} images 
 * @param {string} expectedFolderName 
 * @param {vscode.Diagnostic[]} diagnostics 
 */
function validateFolderNames(document, images, expectedFolderName, diagnostics) {
    images.forEach(image => {
        const srcPath = image.src;
        
        // Check if this is the expected folder pattern
        if (srcPath && !srcPath.includes(expectedFolderName)) {
            const range = getMatchRange(document, image);
            
            // Create diagnostic
            const diagnostic = new vscode.Diagnostic(
                range,
                `Image source should be in "${expectedFolderName}" folder`,
                vscode.DiagnosticSeverity.Warning
            );
            
            diagnostic.source = 'Educational Validator';
            
            // Try to create a corrected path
            if (!image.hasScAttribute) {
                const imageName = path.basename(srcPath);
                const correctedSrc = `${expectedFolderName}/${imageName}`;
                const correctedTag = image.fullMatch.replace(srcPath, correctedSrc);
                
                diagnostic.code = {
                    value: 'fix-image-folder',
                    target: vscode.Uri.parse(`command:educational-validator.fixIssue?${encodeURIComponent(JSON.stringify([
                        document.uri.toString(),
                        range,
                        correctedTag
                    ]))}`)
                };
            }
            
            diagnostics.push(diagnostic);
        }
    });
}

/**
 * Validate image numbering (01, 02, etc. in sequence)
 * @param {vscode.TextDocument} document 
 * @param {Array} images 
 * @param {vscode.Diagnostic[]} diagnostics 
 */
function validateImageNumbering(document, images, diagnostics) {
    // Extract image numbers
    const imageNumbers = [];
    const imageMap = new Map(); // Maps number to image object
    
    images.forEach(image => {
        const srcPath = image.src;
        const match = /\/(\d+)\./.exec(srcPath);
        
        if (match) {
            const number = parseInt(match[1], 10);
            imageNumbers.push(number);
            imageMap.set(number, image);
        }
    });
    
    // If no numbered images, return
    if (imageNumbers.length === 0) {
        return;
    }
    
    // Sort numbers for checking sequence
    const sortedNumbers = [...imageNumbers].sort((a, b) => a - b);
    
    // Check for duplicates
    const uniqueNumbers = new Set(imageNumbers);
    if (uniqueNumbers.size !== imageNumbers.length) {
        // Find duplicates
        const counts = {};
        imageNumbers.forEach(num => {
            counts[num] = (counts[num] || 0) + 1;
        });
        
        Object.entries(counts).forEach(([num, count]) => {
            if (count > 1) {
                const image = imageMap.get(parseInt(num, 10));
                if (image) {
                    const range = getMatchRange(document, image);
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Duplicate image number: ${num} is used ${count} times`,
                        vscode.DiagnosticSeverity.Error
                    );
                    
                    diagnostic.source = 'Educational Validator';
                    diagnostics.push(diagnostic);
                }
            }
        });
    }
    
    // Check for sequential ordering
    const firstNumber = sortedNumbers[0];
    let expectedNumber = firstNumber;
    
    if (firstNumber !== 1) {
        // First image should typically be numbered 01
        const image = imageMap.get(firstNumber);
        if (image) {
            const range = getMatchRange(document, image);
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Image numbering should start with 01, found ${String(firstNumber).padStart(2, '0')}`,
                vscode.DiagnosticSeverity.Warning
            );
            
            diagnostic.source = 'Educational Validator';
            diagnostics.push(diagnostic);
        }
    }
    
    // Check sequence
    for (let i = 0; i < sortedNumbers.length; i++) {
        const currentNum = sortedNumbers[i];
        
        if (i > 0 && currentNum !== sortedNumbers[i-1] + 1) {
            // Gap in sequence
            const image = imageMap.get(currentNum);
            if (image) {
                const range = getMatchRange(document, image);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Image numbering is not sequential. Expected ${String(sortedNumbers[i-1] + 1).padStart(2, '0')}, found ${String(currentNum).padStart(2, '0')}`,
                    vscode.DiagnosticSeverity.Warning
                );
                
                diagnostic.source = 'Educational Validator';
                diagnostics.push(diagnostic);
            }
        }
    }
}

/**
 * Create a VSCode range from a match
 * @param {vscode.TextDocument} document 
 * @param {Object} match 
 * @returns {vscode.Range}
 */
function getMatchRange(document, match) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match.fullMatch.length);
    return new vscode.Range(startPos, endPos);
}

module.exports = {
    validate,
    findAllImages,
    validateFolderNames,
    validateImageNumbering,
    findImageTagTypos
};