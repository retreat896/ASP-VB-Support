const vscode = require('vscode');
const prettier = require('prettier');

function activate(context) {
    let disposable = vscode.languages.registerDocumentFormattingEditProvider('asp', {
        async provideDocumentFormattingEdits(document, options, token) {
            const text = document.getText();
            try {
                const formattedText = await formatASP(text, document.uri.fsPath);
                
                const lastLine = document.lineAt(document.lineCount - 1);
                const range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
                return [vscode.TextEdit.replace(range, formattedText)];
            } catch (err) {
                vscode.window.showWarningMessage('Classic ASP Formatter: ' + err.message);
                return [];
            }
        }
    });

    context.subscriptions.push(disposable);
}

async function formatASP(text, filePath) {
    const placeholders = [];
    let counter = 0;
    
    // Match <% ... %> and <%= ... %> blocks
    const aspRegex = /<%[\s\S]*?%>/g;
    
    const placeholderText = text.replace(aspRegex, (match) => {
        const placeholder = `ASP_PH_${counter++}_`;
        placeholders.push({ placeholder, original: match });
        return `/* ${placeholder} */ 0`;
    });
    
    // Resolve prettier options for the file if any exist
    let prettierOptions = {};
    try {
        const config = await prettier.resolveConfig(filePath);
        if (config) {
            prettierOptions = config;
        }
    } catch (e) {
        // Ignore config resolution errors
    }
    
    // Setup formatting options
    const options = {
        ...prettierOptions,
        parser: 'html',
        filepath: filePath
    };
    
    // If some standard options are missing, set defaults
    if (options.tabWidth === undefined) options.tabWidth = 4;
    if (options.printWidth === undefined) options.printWidth = 120;
    
    let formatted = await prettier.format(placeholderText, options);
    
    // Restore placeholders using a regex that handles potential spacing changes made by Prettier
    for (const item of placeholders) {
        const regex = new RegExp('\\/\\*\\s*' + item.placeholder + '\\s*\\*\\/\\s*0', 'g');
        formatted = formatted.replace(regex, item.original);
    }
    
    return formatted;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
