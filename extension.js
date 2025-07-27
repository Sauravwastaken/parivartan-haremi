const vscode = require('vscode');
const markRule = require('./src/markRule');
const imageRule = require('./src/imageRule');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Educational Content Validator is now active');

    // Create diagnostics collection
    const diagnosticsCollection = vscode.languages.createDiagnosticCollection('educational-validator');
    context.subscriptions.push(diagnosticsCollection);

    // Register document validation events
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => validateDocument(document, diagnosticsCollection)),
        vscode.workspace.onDidChangeTextDocument(event => validateDocument(event.document, diagnosticsCollection)),
        vscode.workspace.onDidCloseTextDocument(document => diagnosticsCollection.delete(document.uri))
    );

    // Register fix command
    context.subscriptions.push(
        vscode.commands.registerCommand('educational-validator.fixIssue', (uri, range, newText) => {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(vscode.Uri.parse(uri), range, newText);
            vscode.workspace.applyEdit(edit);
        })
    );

    

    

    // Validate currently open document
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document, diagnosticsCollection);
    }
}

/**
 * Validate document using all rules
 * @param {vscode.TextDocument} document 
 * @param {vscode.DiagnosticCollection} diagnosticsCollection 
 */
function validateDocument(document, diagnosticsCollection) {
    if (!isHtmlLike(document)) {
        return; // Only validate HTML-like documents
    }

    const diagnostics = [];
    
    // Apply each rule
    markRule.validate(document, diagnostics);
    imageRule.validate(document, diagnostics);
    
    // Update diagnostics collection
    diagnosticsCollection.set(document.uri, diagnostics);
}

/**
 * Check if document is HTML-like
 * @param {vscode.TextDocument} document 
 * @returns {boolean}
 */
function isHtmlLike(document) {
    return document.languageId === 'html' || 
           document.languageId === 'php' ||
           document.fileName.endsWith('.html') ||
           document.fileName.endsWith('.htm');
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}