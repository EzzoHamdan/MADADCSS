
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const chokidar = require('chokidar');
const { JSDOM } = require('jsdom');
const cheerio = require('cheerio');
const port = process.env.PORT || 3000;

class SimpleCSSPreprocessor {
    constructor(fetchFile = 'static.css') {
        this.fetchFile = fetchFile;
        this.cache = {};
        this.replacedClasses = new Set();  // Keep track of replaced classes
    }

    preprocess(code, fileType) {
        if (fileType === 'css') {
            return this.preprocessCSS(code);
        } else if (fileType === 'html') {
            return this.preprocessHTML(code);
        }
    }

    preprocessCSS(code) {
        let preprocessedCode = '';
        let classes = '';
        let processingFetchClass = false;
        const lines = code.split('\n');

        for (const line of lines) {
            if (line.includes("fetchClass:") || processingFetchClass) {
                classes += line.includes(":") ? line.split(":")[1].trim() : line.trim();
                processingFetchClass = !classes.includes(';');

                if (!processingFetchClass) {
                    const classNames = classes.match(/(\w+(-\w+)*-\[[^\]]+\]|[\w-]+)/g);
                    for (const className of classNames) {
                        const includedCode = this.includeClass(className.trim());
                        if (includedCode) {
                            preprocessedCode += includedCode;
                        }
                    }
                    classes = '';
                }
            } else {
                preprocessedCode += line + '\n';
            }
        }

        return preprocessedCode;
    }

    preprocessHTML(code) {
        const dom = new JSDOM(code);
        const document = dom.window.document;
        const elements = document.querySelectorAll('*');

        elements.forEach(element => {
            const classNames = element.className.split(' ');
            let stylesApplied = false;

            // Iterate through class names and apply styles if necessary
            classNames.forEach(className => {
                if (className.includes('[') || className.includes(']')) {
                    const includedCode = this.includeClass(className.trim());
                    if (includedCode) {
                        // Apply the included code as inline style
                        element.setAttribute('style', element.style.cssText + includedCode);
                        stylesApplied = true;
                        this.replacedClasses.add(className);  // Mark class as replaced
                    }
                }
            });

            // Remove class names that have been replaced with inline styles
            if (stylesApplied) {
                element.className = classNames.filter(className => !this.replacedClasses.has(className)).join(' ');
            }
        });

        return dom.serialize();
    }

    includeClass(className) {
        if (this.cache[className]) {
            return this.cache[className];
        }

        let savedValues = [];
        let originalClassName = className;
        let fetchFile = this.fetchFile;

        if (className.includes('[') || className.includes(']')) {
            fetchFile = 'custom.css';
            let start = className.indexOf('[') + 1;
            let end = className.indexOf(',');

            while (end !== -1) {
                savedValues.push(className.slice(start, end));
                start = end + 1;
                end = className.indexOf(',', start);
            }

            end = className.indexOf(']');
            savedValues.push(className.slice(start, end));
            className = className.split('[')[0];
        }

        if (className.endsWith(';')) {
            className = className.slice(0, -1);
        }

        className = className.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

        let fetchCode;
        try {
            fetchCode = fs.readFileSync(fetchFile, 'utf8').split('\n');
        } catch (err) {
            console.error(`Error: File '${fetchFile}' not found.`);
            return null;
        }

        let inClassBlock = false;
        let classBlock = '';

        for (const line of fetchCode) {
            if (new RegExp(`\\.${className}\\s*\\{`).test(line)) {
                inClassBlock = true;
            } else if (line.includes("}") && inClassBlock) {
                let valueIndex = 0;
                classBlock = classBlock.replace(/<>/g, () => savedValues[valueIndex++] || '');
                this.cache[originalClassName] = classBlock;
                return classBlock;
            } else if (inClassBlock) {
                classBlock += line + '\n';
            }
        }

        console.warn(`Warning: Class '${originalClassName}' not found in '${fetchFile}'`);
        return null;
    }
}

let dynamicCSS = '';
let isProcessingMess = false;
let isWriting = false;
let dynamicHTML = '';

const preprocessMess = () => {
    if (isProcessingMess) return;

    isProcessingMess = true;
    console.time('preprocessMess');

    fs.readFile('core.mess', 'utf8', (err, code) => {
        if (err) {
            console.error(`Error reading core.mess: ${err}`);
            console.timeEnd('preprocessMess');
            isProcessingMess = false;
            return;
        }

        const preprocessor = new SimpleCSSPreprocessor();
        const compiledCSS = preprocessor.preprocess(code, 'css');

        if (compiledCSS) {
            dynamicCSS = compiledCSS;
            console.log('dynamic.css updated successfully.');
            console.timeEnd('preprocessMess');
            isProcessingMess = false;
        }
    });
};

const preprocessHtml = (filePath) => {
    fs.readFile(filePath, 'utf8', (err, code) => {
        console.time('preprocessHtml');

        if (err) {
            console.error(`Error reading ${filePath}: ${err}`);
            console.timeEnd('preprocessHtml');
            return;
        }

        const preprocessor = new SimpleCSSPreprocessor();
        const compiledHTML = preprocessor.preprocess(code, 'html');

        if (compiledHTML) {
            isWriting = true;
            dynamicHTML = compiledHTML;
            console.log(`${filePath} updated successfully.`);
            console.timeEnd('preprocessHtml');
        } else {
            console.error(`Failed to preprocess HTML for ${filePath}`);
        }

        isWriting = false;
    });
};


fs.watch('core.mess', (eventType, filename) => {
    if (eventType === 'change' && !isProcessingMess) {
        console.log(`.mess file changed: ${filename}`);
        preprocessMess();
        io.emit('reload');
    }
});

chokidar.watch('./try.html').on('change', (filePath) => {
    if (!isWriting) {
        console.log(`HTML file changed: ${filePath}`);
        preprocessHtml(filePath);
        io.emit('reload');
    }
});

let initialPreprocess = true;
if (initialPreprocess) {
    fs.readdirSync('.').forEach(file => {
        if (path.extname(file) === '.html') {
            preprocessHtml(file);
        }
    });
    preprocessMess();

    const scriptTags = `
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        socket.on('reload', () => {
            location.reload();
        });
    </script>
    `;

    fs.readdirSync('.').forEach(file => {
        if (path.extname(file) === '.html') {
            const html = fs.readFileSync(file, 'utf-8');
            const $ = cheerio.load(html);

            if ($('body').html().indexOf(scriptTags) === -1) {
                $('body').append(scriptTags);
                fs.writeFileSync(file, $.html());
            }
        }
    });

    initialPreprocess = false;
}

app.get('/dynamic.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.send(dynamicCSS);
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.send(dynamicHTML);
});

app.get('/:file', (req, res) => {
    const filePath = path.join(__dirname, req.params.file);
    if (fs.existsSync(filePath) && path.extname(filePath) === '.html') {
        fs.readFile(filePath, 'utf8', (err, code) => {
            if (err) {
                res.status(500).send(`Error reading ${filePath}: ${err}`);
                return;
            }

            const preprocessor = new SimpleCSSPreprocessor();
            const compiledHTML = preprocessor.preprocess(code, 'html');

            if (compiledHTML) {
                res.send(compiledHTML);
            } else {
                res.status(500).send(`Error preprocessing HTML for ${filePath}`);
            }
        });
    } else {
        res.status(404).send('File not found');
    }
});

http.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/`);
});