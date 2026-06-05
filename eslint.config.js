const globals = require("globals");
const htmlPlugin = require("eslint-plugin-html");
const extract = require("eslint-plugin-html/src/extract");
const { remapMessages } = require("eslint-plugin-html/src/remapMessages");
const { getSettings } = require("eslint-plugin-html/src/settings");

// Keep track of extracted code blocks for postprocessing
const fileExtracts = new Map();

const aspProcessor = {
  preprocess(text, filename) {
    // Normalize IE-only script tag syntax: <script type="..." FOR=window EVENT=onload>
    // eslint-plugin-html only recognizes standard <script> tags. The FOR/EVENT attributes
    // are an old IE extension that causes the plugin to skip the block entirely, producing
    // no errors but also no linting. Strip them so the block is treated as a normal script.
    const normalizedText = text.replace(
      /<script([^>]*?)\s+FOR\s*=\s*["']?window["']?\s+EVENT\s*=\s*["']?[^"'\s>]*["']?([^>]*)>/gi,
      "<script$1$2>"
    );

    const aspRegex = /<%([\s\S]*?)%>/g;
    const preprocessedText = normalizedText.replace(aspRegex, (match, p1, offset, string) => {
      const len = match.length;
      if (len < 4) return " ".repeat(len); // fallback
      
      const hasNewline = match.includes("\n") || match.includes("\r");
      const prevChar = offset > 0 ? string[offset - 1] : " ";
      const nextChar = offset + match.length < string.length ? string[offset + match.length] : " ";
      
      // If the block is sandwiched between non-whitespace characters, it's likely embedded 
      // inside an identifier or property access (e.g. document.<% %>record).
      const isEmbedded = !/\s/.test(prevChar) && !/\s/.test(nextChar);
      
      if (!hasNewline && isEmbedded) {
        // For embedded single-line ASP blocks, replace entirely with underscores.
        // This prevents ESLint from breaking when ASP blocks split JavaScript identifiers.
        // A block of underscores is a valid JS identifier of the exact same length.
        return "_".repeat(len);
      }
      
      const isExpression = match.startsWith("<%=");
      let chars = match.split("");
      
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== "\r" && chars[i] !== "\n") {
          chars[i] = " ";
        }
      }
      
      if (isExpression) {
        chars[0] = "0";
      }
      
      return chars.join("");
    });
    
    const settings = getSettings({});
    const extractResult = extract(preprocessedText, false, settings);
    
    fileExtracts.set(filename, extractResult);
    
    // Return objects with text and filename ending in .js so ESLint knows how to parse them
    return extractResult.code.map((codePart, index) => ({
      text: String(codePart),
      filename: `${index}.js`,
    }));
  },
  postprocess(messages, filename) {
    const extractResult = fileExtracts.get(filename);
    if (!extractResult) {
      return [];
    }
    fileExtracts.delete(filename);
    
    const flattenedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const blockMessages = messages[i];
      const codePart = extractResult.code[i];
      if (codePart) {
        const remapped = remapMessages(blockMessages, extractResult.hasBOM, codePart);
        // Filter out false-positive no-unused-vars for top-level function declarations.
        // In an ASP page, each <script> block is linted in isolation, so ESLint cannot
        // see functions being called from onclick/onchange attributes or other script
        // blocks. Top-level function declarations are always globally accessible in
        // a browser page and should never be flagged as unused.
        const blockSource = String(codePart);
        const filteredRemapped = remapped.filter((msg) => {
          if (msg.ruleId === "no-undef") {
            const varMatch = msg.message.match(/'([^']+)' is not defined/);
            if (varMatch && /^_{5,}$/.test(varMatch[1])) {
              return false; // Suppress undefined errors for our underscore placeholders
            }
          }
          
          if (msg.ruleId !== "no-unused-vars") return true;
          // Check if the reported identifier is a top-level function declaration
          // by looking for "function <name>" at the start of a line (after trimming).
          const varName = msg.message.match(/'([^']+)' is defined but never used/);
          if (!varName) return true;
          const fnPattern = new RegExp(
            `^\\s*function\\s+${varName[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`,
            "m"
          );
          // If it's a top-level function declaration, suppress the warning.
          if (fnPattern.test(blockSource)) return false;
          return true;
        });
        flattenedMessages.push(...filteredRemapped);
      }
    }
    return flattenedMessages;
  },
  supportsAutofix: true
};

module.exports = [
  {
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        $: "readonly",
        jQuery: "readonly",
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error",
      "eqeqeq": "off",
      "no-console": "off",
    }
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      }
    }
  },
  {
    files: ["**/*.asp"],
    plugins: {
      html: htmlPlugin,
    },
    processor: aspProcessor,
    settings: {
      "html/html-extensions": [".asp", ".html"]
    },
  },
];