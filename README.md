# Classic ASP VBScript & JavaScript Support for VS Code

This extension provides robust syntax highlighting, formatting, and linting configuration for Classic ASP (`.asp`, `.asa`) files with embedded HTML.

## Features

- **Nested Expressions Support**: Supports Classic ASP delimiters (`<% ... %>` and `<%= ... %>`) inside HTML tag attributes (e.g., `onclick`, `href`, `class`) without causing double-quote syntax validation issues in VS Code.
- **Embedded JavaScript Syntax Highlighting**: Event attributes like `onclick="..."` and CSS/JS code blocks will show full, rich syntax highlighting for JavaScript and CSS instead of plain string coloring.
- **Dynamic JavaScript Syntaxing**: Automatically colors server-side ASP `<% ... %>` blocks using the JavaScript grammar (`source.js`) instead of VBScript if the file starts with a JavaScript/JScript directive (`<%@ Language="JavaScript" %>`).
- **Prettier-based Formatting**: Formats the HTML layout and embedded JavaScript `<script>` blocks using Prettier, while keeping embedded ASP code blocks intact.
- **VBScript Syntax Highlighting**: Basic syntax highlighting for keywords, comments, strings, operators, and built-in objects (`Request`, `Response`, `Session`, `Application`, `Server`).
- **Language Configurations**: Auto-closes double quotes, single quotes, parentheses, brackets, and comments using `'`.

## How to Install

1. Copy or link this folder (`VSCASP`) into the VS Code extensions directory:
   - **Windows**: `%USERPROFILE%\.vscode\extensions\asp-vb-syntax`
   - **macOS/Linux**: `~/.vscode/extensions/asp-vb-syntax`
2. Open terminal in `%USERPROFILE%\.vscode\extensions\asp-vb-syntax` and run:
   ```bash
   npm install
   ```
3. Restart Visual Studio Code.
4. Open any `.asp` or `.asa` file. The language indicator in the bottom-right status bar should automatically detect it as **Classic ASP**.

## Formatting & Linting Configuration

### Formatting
To use formatting, simply press `Shift+Alt+F` (or right-click -> **Format Document**). Prettier will format HTML and embedded `<script>` blocks.

### Linting (ESLint)
To enable JavaScript linting inside script tags and event handlers in Classic ASP files:
1. Install the official **ESLint** VS Code extension.
2. In your workspace root, install the dependencies:
   ```bash
   npm install eslint eslint-plugin-html --save-dev
   ```
3. Add an ESLint configuration file (e.g., `eslint.config.js` or `.eslintrc.js`) in your project root using the HTML plugin processor for `*.asp` files:
   
   **Flat Config (`eslint.config.js`):**
   ```javascript
   import html from "eslint-plugin-html";

   export default [
     {
       files: ["**/*.asp"],
       plugins: {
         html,
       },
       languageOptions: {
         sourceType: "script",
       },
     },
   ];
   ```

