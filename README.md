# Classic ASP VBScript & JavaScript Support for VS Code

This extension provides robust syntax highlighting, formatting, and linting configuration for Classic ASP (`.asp`, `.asa`) files with embedded HTML.

Server-side values can be used by embedding ASP output blocks directly inside html tags or inline attributes:

```html
<a href="profile.asp?user=<%= Session("UserID") %>">
    <% If Session("UserID") <> "" Then %>
        View Profile
    <% Else %>
        Guest Profile
    <% End If %>
</a>
```

## Features

- **Nested Expressions Support**: Supports Classic ASP delimiters (`<% ... %>` and `<%= ... %>`) inside HTML tag attributes (e.g., `onclick`, `href`, `class`) without causing double-quote syntax validation issues in VS Code.
- **Embedded JavaScript Syntax Highlighting**: Event attributes like `onclick="..."` and CSS/JS code blocks will show full, rich syntax highlighting for JavaScript and CSS instead of plain string coloring.
- **Embedded String Styling**: Strings inside VBScript ASP code blocks (like `"SiteDomain"` in `<%=Application("SiteDomain")%>`) are assigned a custom scope (`string.quoted.double.asp.embedded`) and are styled as *italicized orange* by default to stand out clearly from the rest of the markup.
- **Dynamic JavaScript Syntaxing**: Automatically colors server-side ASP `<% ... %>` blocks using the JavaScript grammar (`source.js`) instead of VBScript if the file starts with a JavaScript/JScript directive (`<%@ Language="JavaScript" %>`).
- **Prettier-based Formatting**: Formats the HTML layout and embedded JavaScript `<script>` blocks using Prettier, while keeping embedded ASP code blocks intact.
- **VBScript Syntax Highlighting**: Basic syntax highlighting for keywords, comments, strings, operators, and built-in objects (`Request`, `Response`, `Session`, `Application`, `Server`).
- **Language Configurations**: Auto-closes double quotes, single quotes, parentheses, brackets, and comments using `'`.

## How to Install

### Option 1: Install Precompiled Release (.vsix)
1. Download the latest `.vsix` file from the [Releases](https://github.com/retreat896/ASP-VB-Support/releases) section.
2. In VS Code, open the Extensions view (`Ctrl+Shift+X`).
3. Click the `...` (More Actions) menu in the top-right corner of the Extensions pane.
4. Select **Install from VSIX...** and choose the downloaded `.vsix` file.

### Option 2: Building Yourself (Manual Installation from Source)
To build, run, and customize the extension directly from the source:
1. Clone the repository into your local VS Code extensions directory:
   - **Windows**:
     ```bash
     cd %USERPROFILE%\.vscode\extensions
     git clone https://github.com/retreat896/ASP-VB-Support.git asp-vb-syntax
     ```
   - **macOS / Linux**:
     ```bash
     cd ~/.vscode/extensions
     git clone https://github.com/retreat896/ASP-VB-Support.git asp-vb-syntax
     ```
2. Navigate into the cloned extension directory and install the necessary dependencies:
   ```bash
   cd asp-vb-syntax
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
   const html = require("eslint-plugin-html");

   module.exports = [
     {
       files: ["**/*.asp"],
       plugins: {
         html,
       },
       settings: {
         "html/html-extensions": [".asp", ".html"]
       },
       languageOptions: {
         sourceType: "script",
       },
     },
   ];
   ```

## Customizing Embedded String Colors

The extension applies a default *italicized orange* color to VBScript strings inside `<% %>` blocks. You can customize or override this styling in your global `settings.json` file:

```json
"editor.tokenColorCustomizations": {
  "textMateRules": [
    {
      "scope": "string.quoted.double.asp.embedded",
      "settings": {
        "foreground": "#E67E22",
        "fontStyle": "italic"
      }
    }
  ]
}
```

## ASP VBScript & HTML Interoperability (Examples)

This extension provides deep interoperability between Classic ASP (VBScript or JScript) and client-side web languages (HTML, JavaScript, and CSS). The following examples demonstrate how different contexts nest together seamlessly, using generic code templates.

### 1. ASP VBScript Nesting inside HTML Markup
Server-side logic and expressions can be placed anywhere inside the HTML structure.
- `<% ... %>` blocks are used for executing logical code, defining variables, and controlling page structure on the server.
- `<%= ... %>` inline directives instantly output computed values directly into the HTML stream.

```html
<%
    Dim greetingMessage, currentYear
    greetingMessage = "Welcome to our customer portal!"
    currentYear = Year(Now())
%>
<header class="site-header">
    <h1><%= greetingMessage %></h1>
    <p>System initialized at: <strong><%= Time() %></strong></p>
    <p>&copy; <%= currentYear %> Global Operations, Inc.</p>
</header>
```

### 2. HTML Markup Nested inside ASP VBScript Control Flow (HTML inside VBScript)
In Classic ASP, server-side loops or conditions often wrap HTML output. You can start a VBScript block, begin a conditional or loop statement, close the ASP delimiter, write raw HTML, and then reopen the ASP block to close or continue the statement.
The grammar automatically tracks when you drop out of VBScript into HTML and vice versa, providing appropriate syntax highlighting for both contexts.

```asp
<%
    Dim userIsLoggedIn, userRole, i
    userIsLoggedIn = Session("IsAuthenticated")
    userRole = Session("UserRole")
%>

<% If userIsLoggedIn Then %>
    <div class="dashboard-panel">
        <h2>Welcome back, <%= Session("UserName") %>!</h2>
        
        <% If userRole = "Admin" Then %>
            <div class="admin-actions">
                <p>System Diagnostics Mode:</p>
                <ul>
                    <% For i = 1 To 3 %>
                        <li>Analyzing server partition <%= i %>: OK</li>
                    <% Next %>
                </ul>
            </div>
        <% End If %>
    </div>
<% Else %>
    <div class="auth-prompt">
        <p>You must sign in to view this portal.</p>
        <a href="login.asp" class="btn-primary">Sign In</a>
    </div>
<% End If %>
```

### 3. ASP VBScript Expressions inside HTML Attributes
Normally, placing ASP delimiters like `<%= ... %>` inside double-quoted HTML attributes causes validation errors or breaks syntax coloring due to quote mismatch conflicts. The injection grammar resolves this by targeting attribute strings and highlighting ASP delimiters as a higher-priority sub-scope.

```html
<!-- ASP expressions inside tag attributes (id, class, and href) -->
<div id="item-<%= Request.QueryString("id") %>" class="list-item <%= GetThemeName() %>">
    <a href="details.asp?id=<%= Request.QueryString("id") %>&session=<%= Session.SessionID %>">
        View Item Details
    </a>
</div>
```

### 4. ASP VBScript Expressions inside Client-Side JavaScript `<script>` Blocks
You can pass server-side VBScript variables to client-side JavaScript. The injection parser allows ASP blocks to be embedded within `<script>` tags, event handlers, and JavaScript strings without causing linting errors or color mismatches.

```html
<button onclick="showAlert('Details: <%= Session("UserType") %>');">
    Show Type
</button>

<script>
    // Server-side string inside client-side JS string
    const serverUrl = "https://<%= Request.ServerVariables("SERVER_NAME") %>/v1/api";
    
    // Server-side boolean mapped to client-side JS boolean
    const devModeActive = <%= LCase(CStr(Session("DeveloperMode"))) %>;
    
    // Server-side numeric value or object mapping
    const trackingConfiguration = {
        sessionId: "<%= Session.SessionID %>",
        refreshInterval: <%= GetRefreshInterval() %>,
        isDebugger: devModeActive
    };
    
    function logState() {
        if (devModeActive) {
            console.log("Connecting to " + serverUrl);
        }
    }
</script>
```

## Capabilities 

### 1. Document-Level Nesting
The root grammar matches standard HTML tags and structure, but looks for `<% ... %>` delimiters at the top level to delegate tokenization to server-side engines.

```html
<div class="user-block">
    <% 
        Dim welcomeMsg
        welcomeMsg = "Welcome Back, " & Session("UserName")
    %>
    <h2><%= welcomeMsg %></h2>
</div>
```

### 2. Nesting inside Event Attributes (onclick/onload)
Normally, placing `<%= ... %>` blocks inside HTML attribute values (like `onclick="..."`) confuses HTML parsers because of quote mismatches. The injection grammar targets the inner double-quoted string scopes of HTML tags to parse the ASP blocks first, preserving the outer HTML attribute boundaries.

```html
<button onclick="displayAlert('Your role: <%=Session("UserRole")%>');">
    View Role
</button>
```

### 3. Nesting inside Client-Side JavaScript Strings
The injection selector maps to JavaScript string scopes (like `L:string.quoted.single.js`), allowing ASP code blocks to be recognized and highlighted as server-side syntax inside client-side JS strings.

```html
<script>
    var apiEndpoint = 'https://www.<%=Application("SiteDomain")%>/api';
</script>
```

### 4. Dynamic Scripting Language Detection
The extension detects file-level language overrides (directives) at the very start of the file. If JScript/JavaScript is specified, all `<% %>` blocks will render using JavaScript grammar (`source.js`) instead of VBScript (`source.asp`).

**VBScript Mode (Default):**
```asp
<%
    Dim output
    output = "VBScript mode"
    Response.Write(output)
%>
```

**JavaScript Mode:**
```asp
<%@ Language="JavaScript" %>
<%
    let output = "JavaScript mode";
    Response.Write(output);
%>
```

### 5. Prettier Formatting Placeholder Strategy
During formatting, the extension converts all `<% ... %>` blocks to valid JS comments and literal values (`/* ASP_PH_i_ */ 0`). This prevents Prettier from throwing parse errors when checking JavaScript inside `<script>` blocks or tag attributes, and allows Prettier to cleanly format your script blocks.

**Input Code:**
```javascript
var apiEndpoint = 'https://www.<%=Application("SiteDomain")%>/api';
```

**Intermediate Format (sent to Prettier):**
```javascript
var apiEndpoint = 'https://www./* ASP_PH_0_ */ 0/api';
```

**Restored Output Code:**
```javascript
var apiEndpoint = 'https://www.<%=Application("SiteDomain")%>/api';
```
