const vscode = require('vscode');

/**
 * Main validation function for mark/marks rule
 * @param {vscode.TextDocument} document 
 * @param {vscode.Diagnostic[]} diagnostics 
 */
function validate(document, diagnostics) {
    const text = document.getText();
    const matches = findTotalQuestionMarks(text);
    
    matches.forEach(match => {
        if (!isCorrectMarkUsage(match.points, match.term)) {
            const range = getMatchRange(document, match);
            const diagnostic = createDiagnostic(range, match.points);
            diagnostics.push(diagnostic);
        }
    });
}

/**
 * Find all instances of "Total for question = X mark(s)" in the text
 * @param {string} text 
 * @returns {Array<{fullMatch: string, points: number, term: string, index: number}>}
 */
function findTotalQuestionMarks(text) {
    const regex = /<p\s+align="right"><b>\(Total for question\s*=\s*(\d+)\s*(mark|marks)\)<\/b><\/p>/gi;
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        matches.push({
            fullMatch: match[0],
            points: parseInt(match[1], 10),
            term: match[2].toLowerCase(),
            index: match.index
        });
    }
    
    return matches;
}

/**
 * Check if the term (mark/marks) is used correctly for the given points
 * @param {number} points 
 * @param {string} term 
 * @returns {boolean}
 */
function isCorrectMarkUsage(points, term) {
    return (points === 1 && term === 'mark') || 
           (points > 1 && term === 'marks');
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

/**
 * Create diagnostic with fix for the mark/marks issue
 * @param {vscode.Range} range 
 * @param {number} points 
 * @returns {vscode.Diagnostic}
 */
function createDiagnostic(range, points) {
    const correctTerm = getCorrectTerm(points);
    const diagnostic = new vscode.Diagnostic(
        range,
        `Use "${correctTerm}" for ${points} point${points > 1 ? 's' : ''}`,
        vscode.DiagnosticSeverity.Warning
    );
    
    diagnostic.source = 'Educational Validator';
    
    // Add fix data as a code action
    const correctText = createCorrectedText(points);
    diagnostic.code = {
        value: 'fix-mark-marks',
        target: vscode.Uri.parse(`command:educational-validator.fixIssue?${encodeURIComponent(JSON.stringify([
            'DOCUMENT_URI_PLACEHOLDER', // This will be replaced with actual URI in the extension.js
            range,
            correctText
        ]))}`)
    };
    
    return diagnostic;
}

/**
 * Get the correct term (mark/marks) for the given points
 * @param {number} points 
 * @returns {string}
 */
function getCorrectTerm(points) {
    return points === 1 ? 'mark' : 'marks';
}

/**
 * Create the corrected HTML text
 * @param {number} points 
 * @returns {string}
 */
function createCorrectedText(points) {
    const term = getCorrectTerm(points);
    return `<p align="right"><b>(Total for question = ${points} ${term})</b></p>`;
}

module.exports = {
    validate,
    // Export additional functions for testing
    findTotalQuestionMarks,
    isCorrectMarkUsage,
    getCorrectTerm,
    createCorrectedText
};