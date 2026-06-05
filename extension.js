/* global require, module, __dirname, process, setTimeout, clearTimeout */
const vscode = require('vscode');
const prettier = require('prettier');

let diagnosticCollection;

function activate(context) {
    // 1. Register Document Formatter Provider
    let formatterDisposable = vscode.languages.registerDocumentFormattingEditProvider('asp', {
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
    context.subscriptions.push(formatterDisposable);

    // 2. Register Diagnostics (VBScript Linter)
    diagnosticCollection = vscode.languages.createDiagnosticCollection('asp-vbscript');
    context.subscriptions.push(diagnosticCollection);

    // Register event listeners to run linter
    vscode.workspace.onDidOpenTextDocument(triggerLint, null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(triggerLint, null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(doc => {
        diagnosticCollection.delete(doc.uri);
    }, null, context.subscriptions);

    let lintTimeout;
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'asp') {
            if (lintTimeout) clearTimeout(lintTimeout);
            lintTimeout = setTimeout(() => triggerLint(event.document), 500);
        }
    }, null, context.subscriptions);

    // Run linting on all active editors on startup
    vscode.window.visibleTextEditors.forEach(editor => {
        if (editor) triggerLint(editor.document);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) triggerLint(editor.document);
    }, null, context.subscriptions);
}

function triggerLint(document) {
    if (document.languageId !== 'asp') return;
    const text = document.getText();
    const errors = lintASP(text);
    
    const diagnostics = errors.map(err => {
        const lineIndex = Math.max(0, err.line - 1);
        const lineText = document.lineAt(lineIndex).text;
        const range = new vscode.Range(
            new vscode.Position(lineIndex, 0),
            new vscode.Position(lineIndex, lineText.length)
        );
        const diagnostic = new vscode.Diagnostic(
            range,
            err.message,
            err.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'Classic ASP VBScript Linter';
        return diagnostic;
    });
    
    diagnosticCollection.set(document.uri, diagnostics);
}

async function formatASP(text, filePath) {
    const placeholders = [];
    let counter = 0;
    
    // Match <% ... %> and <%= ... %> blocks
    const aspRegex = /<%[\s\S]*?%>/g;
    
    const placeholderText = text.replace(aspRegex, (match) => {
        const placeholder = `ASP_PH_${counter++}_`;
        placeholders.push({ placeholder, original: match });
        return placeholder;
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
    
    // Handle HTML comments inside <style> tags which make Prettier CSS parser fail.
    // We wrap <!-- and --> in CSS comments: /* <!-- */ and /* --> */
    const styleBlockRegex = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
    let preProcessedText = placeholderText.replace(styleBlockRegex, (match, openTag, content, closeTag) => {
        let cleanContent = content;
        cleanContent = cleanContent.replace(/<!--/g, '/* style_comment_open */');
        cleanContent = cleanContent.replace(/-->/g, '/* style_comment_close */');
        // Wrap naked ASP identifiers in CSS comments so they don't cause parser errors
        cleanContent = cleanContent.replace(/(ASP_PH_\d+_)/g, '/* $1 */');
        return openTag + cleanContent + closeTag;
    });

    function wrapPlaceholdersInScript(scriptContent) {
        let result = "";
        let state = "CODE"; // CODE, LINE_COMMENT, BLOCK_COMMENT, STRING_S, STRING_D, STRING_T
        let i = 0;
        while (i < scriptContent.length) {
            if (state === "CODE") {
                if (scriptContent.startsWith("//", i)) {
                    state = "LINE_COMMENT";
                    result += "//"; i += 2;
                } else if (scriptContent.startsWith("/*", i)) {
                    state = "BLOCK_COMMENT";
                    result += "/*"; i += 2;
                } else if (scriptContent[i] === "'") {
                    state = "STRING_S";
                    result += "'"; i++;
                } else if (scriptContent[i] === '"') {
                    state = "STRING_D";
                    result += '"'; i++;
                } else if (scriptContent[i] === "`") {
                    state = "STRING_T";
                    result += "`"; i++;
                } else if (scriptContent.startsWith("ASP_PH_", i)) {
                    let match = scriptContent.substring(i).match(/^ASP_PH_\d+_/);
                    if (match) {
                        result += "/* " + match[0] + " */";
                        i += match[0].length;
                    } else {
                        result += scriptContent[i]; i++;
                    }
                } else {
                    result += scriptContent[i]; i++;
                }
            } else if (state === "LINE_COMMENT") {
                if (scriptContent[i] === "\n") {
                    state = "CODE";
                }
                result += scriptContent[i]; i++;
            } else if (state === "BLOCK_COMMENT") {
                if (scriptContent.startsWith("*/", i)) {
                    state = "CODE";
                    result += "*/"; i += 2;
                } else {
                    result += scriptContent[i]; i++;
                }
            } else if (state === "STRING_S") {
                if (scriptContent[i] === "\\") {
                    result += scriptContent[i] + (scriptContent[i+1] || ""); i += 2;
                } else if (scriptContent[i] === "'") {
                    state = "CODE";
                    result += "'"; i++;
                } else {
                    result += scriptContent[i]; i++;
                }
            } else if (state === "STRING_D") {
                if (scriptContent[i] === "\\") {
                    result += scriptContent[i] + (scriptContent[i+1] || ""); i += 2;
                } else if (scriptContent[i] === '"') {
                    state = "CODE";
                    result += '"'; i++;
                } else {
                    result += scriptContent[i]; i++;
                }
            } else if (state === "STRING_T") {
                if (scriptContent[i] === "\\") {
                    result += scriptContent[i] + (scriptContent[i+1] || ""); i += 2;
                } else if (scriptContent[i] === "`") {
                    state = "CODE";
                    result += "`"; i++;
                } else {
                    result += scriptContent[i]; i++;
                }
            }
        }
        return result;
    }

    const scriptBlockRegex = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi;
    preProcessedText = preProcessedText.replace(scriptBlockRegex, (match, openTag, content, closeTag) => {
        return openTag + wrapPlaceholdersInScript(content) + closeTag;
    });
    
    let formatted = await prettier.format(preProcessedText, options);
    
    // Restore style tag HTML comments
    formatted = formatted.replace(/\/\*\s*style_comment_open\s*\*\//g, '<!--');
    formatted = formatted.replace(/\/\*\s*style_comment_close\s*\*\//g, '-->');
    
    // Restore placeholders using a regex that handles potential spacing changes made by Prettier
    // as well as optional CSS comments added during pre-processing
    for (const item of placeholders) {
        // Match optional /* */ wrappers and optional trailing semicolon added by JS formatters
        const regex = new RegExp('(?:\\/\\*\\s*)?' + item.placeholder + '(?:\\s*\\*\\/)?(?:;)?', 'g');
        formatted = formatted.replace(regex, item.original);
    }
    
    return formatted;
}

// --- VBScript Linter Logic ---

function tokenizeLine(line) {
    // Replace string literals with spaces to avoid keyword matching inside strings.
    // VBScript uses "" (two double-quotes) as an escaped quote INSIDE a string,
    // so we must skip over consecutive "" pairs without toggling inString.
    let inString = false;
    let cleanLine = "";
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inString && line[i + 1] === '"') {
                // VBScript escaped quote "" inside a string — skip both, stay inString
                cleanLine += "  ";
                i++; // skip the second quote
            } else {
                inString = !inString;
                cleanLine += " ";
            }
        } else if (inString) {
            cleanLine += " ";
        } else {
            cleanLine += char;
        }
    }

    // Strip comments (VBScript comments start with ' or Rem)
    const commentIndex = cleanLine.indexOf("'");
    if (commentIndex !== -1) {
        cleanLine = cleanLine.substring(0, commentIndex);
    }
    cleanLine = cleanLine.replace(/\brem\b.*/i, "");

    // Split by colons to handle multiple statements on one line
    const statements = cleanLine.split(":");
    return statements.map(s => s.trim().split(/\s+/).filter(Boolean));
}

// Lines containing these directives suppress linter warnings for that line or the next.
// Usage in VBScript:  '' vbslint-disable-next-line
//                     '' vbslint-disable
const DISABLE_NEXT = /''\s*vbslint-disable-next-line/i;
const DISABLE_LINE = /''\s*vbslint-disable/i;

function lintASP(text) {
    const diagnostics = [];
    const lines = text.split(/\r?\n/);
    const stack = [];
    
    let inASP = false;
    let aspLinesBuffer = []; // array of { text, line, disabled }
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        let remaining = lineText;
        
        while (remaining.length > 0) {
            if (!inASP) {
                const startIdx = remaining.indexOf("<%");
                if (startIdx !== -1) {
                    inASP = true;
                    remaining = remaining.substring(startIdx + 2);
                    const endIdx = remaining.indexOf("%>");
                    if (endIdx !== -1) {
                        const aspPart = remaining.substring(0, endIdx);
                        const disabled = DISABLE_LINE.test(aspPart);
                        aspLinesBuffer.push({ text: aspPart, line: lineIdx + 1, disabled });
                        inASP = false;
                        remaining = remaining.substring(endIdx + 2);
                    } else {
                        const disabled = DISABLE_LINE.test(remaining);
                        aspLinesBuffer.push({ text: remaining, line: lineIdx + 1, disabled });
                        remaining = "";
                    }
                } else {
                    remaining = "";
                }
            } else {
                const endIdx = remaining.indexOf("%>");
                if (endIdx !== -1) {
                    const aspPart = remaining.substring(0, endIdx);
                    const disabled = DISABLE_LINE.test(aspPart);
                    aspLinesBuffer.push({ text: aspPart, line: lineIdx + 1, disabled });
                    inASP = false;
                    remaining = remaining.substring(endIdx + 2);
                } else {
                    const disabled = DISABLE_LINE.test(remaining);
                    aspLinesBuffer.push({ text: remaining, line: lineIdx + 1, disabled });
                    remaining = "";
                }
            }
        }
    }
    
    let lineIdx = 0;
    let suppressNextLine = false;
    while (lineIdx < aspLinesBuffer.length) {
        let current = aspLinesBuffer[lineIdx];
        let statementText = current.text;
        let origLine = current.line;
        
        // Check for disable directives in the raw line text
        const rawText = current.text;
        const suppressThis = current.disabled || suppressNextLine;
        suppressNextLine = DISABLE_NEXT.test(rawText);
        
        let statementTokensList = tokenizeLine(statementText);
        
        // If this line is suppressed, skip all block tracking for it
        if (suppressThis) {
            lineIdx++;
            continue;
        }
        
        // Handle line continuations (ending with "_")
        while (statementTokensList.length > 0 && 
               statementTokensList[statementTokensList.length - 1].length > 0 &&
               statementTokensList[statementTokensList.length - 1][statementTokensList[statementTokensList.length - 1].length - 1] === "_") {
            
            statementTokensList[statementTokensList.length - 1].pop(); // remove "_"
            
            lineIdx++;
            if (lineIdx < aspLinesBuffer.length) {
                let nextTokensList = tokenizeLine(aspLinesBuffer[lineIdx].text);
                if (nextTokensList.length > 0) {
                    // Merge the first statement of the next line into the last statement of the current line
                    statementTokensList[statementTokensList.length - 1] = statementTokensList[statementTokensList.length - 1].concat(nextTokensList[0]);
                    
                    // If the next line had multiple statements, append them
                    for (let i = 1; i < nextTokensList.length; i++) {
                        statementTokensList.push(nextTokensList[i]);
                    }
                }
            } else {
                break;
            }
        }
        
        for (const tokens of statementTokensList) {
            if (tokens.length === 0) continue;
            
            const first = tokens[0].toLowerCase();
            const second = tokens[1] ? tokens[1].toLowerCase() : "";
            
            if (first === "end") {
                if (second === "if") {
                    closeBlock(stack, "if", origLine, diagnostics);
                } else if (second === "sub") {
                    closeBlock(stack, "sub", origLine, diagnostics);
                } else if (second === "function") {
                    closeBlock(stack, "function", origLine, diagnostics);
                } else if (second === "select") {
                    closeBlock(stack, "select", origLine, diagnostics);
                } else if (second === "class") {
                    closeBlock(stack, "class", origLine, diagnostics);
                } else if (second === "with") {
                    closeBlock(stack, "with", origLine, diagnostics);
                }
            } else if (first === "if") {
                const thenIdx = tokens.findIndex(t => t.toLowerCase() === "then");
                if (thenIdx !== -1) {
                    if (thenIdx === tokens.length - 1) {
                        stack.push({ type: "if", line: origLine });
                    }
                }
            } else if (first === "sub") {
                stack.push({ type: "sub", line: origLine });
            } else if (first === "function") {
                stack.push({ type: "function", line: origLine });
            } else if (first === "for") {
                stack.push({ type: "for", line: origLine });
            } else if (first === "next") {
                closeBlock(stack, "for", origLine, diagnostics);
            } else if (first === "do") {
                stack.push({ type: "do", line: origLine });
            } else if (first === "loop") {
                closeBlock(stack, "do", origLine, diagnostics);
            } else if (first === "select" && second === "case") {
                stack.push({ type: "select", line: origLine });
            } else if (first === "class") {
                stack.push({ type: "class", line: origLine });
            } else if (first === "with") {
                stack.push({ type: "with", line: origLine });
            }
        }
        
        lineIdx++;
    }
    
    while (stack.length > 0) {
        const unclosed = stack.pop();
        diagnostics.push({
            line: unclosed.line,
            severity: "error",
            message: `Unclosed "${unclosed.type.toUpperCase()}" block (missing "End ${unclosed.type.charAt(0).toUpperCase() + unclosed.type.slice(1)}" or matching closing token).`
        });
    }
    
    return diagnostics;
}

function closeBlock(stack, type, line, diagnostics) {
    if (stack.length === 0) {
        diagnostics.push({
            line: line,
            severity: "error",
            message: `Unexpected closing token "End ${type.charAt(0).toUpperCase() + type.slice(1)}" / "${type === "for" ? "Next" : type === "do" ? "Loop" : ""}" without matching opening block.`
        });
        return;
    }
    
    const top = stack[stack.length - 1];
    if (top.type === type) {
        stack.pop();
    } else {
        diagnostics.push({
            line: line,
            severity: "error",
            message: `Mismatched closing token: expected closing for "${top.type.toUpperCase()}" (opened on line ${top.line}) but found closing for "${type.toUpperCase()}".`
        });
        stack.pop();
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
