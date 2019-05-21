const http = require('http');
const path = require('path');
const fs = require('fs');
const util = require('util');

const handlebars = require('handlebars');
const chalk = require('chalk');
const conf = require('./config/default');
const mime = require('./helper/mime.js');

const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);

const tplPath = path.join(__dirname, './template/dir.tpl');
const source = fs.readFileSync(tplPath);
const template = handlebars.compile(source.toString());

const server = http.createServer((req, res) => {
    const filePath = path.join(conf.root, req.url);
    (async () => {
        try {
            const stats = await stat(filePath);
            if (stats.isFile()) {
                const contentType = mime(filePath);
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                fs.createReadStream(filePath).pipe(res);
            } else if (stats.isDirectory()) {
                const files = await readdir(filePath);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
                const dir = path.relative(conf.root, filePath)
                const data = {
                    title: path.basename(filePath),
                    dir: dir ? `/${dir}` : '',
                    files
                };
                res.end(template(data));
            }
        } catch (error) {
            if(error) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`${filePath} is not a directory or file`);
            }
        }
    })();
});

server.listen(conf.port, conf.hostname, () => {
    const addr = `http://${conf.hostname}:${conf.port}`
    console.info(`Server started at ${chalk.green(addr)}`)
});
