const http = require('http');
const path = require('path');
const fs = require('fs');
const util = require('util');

const handlebars = require('handlebars');
const chalk = require('chalk');
const conf = require('./config/default');
const mime = require('./helper/mime');
const compress = require('./helper/compress');
const range = require('./helper/range');
const isFresh = require('./helper/cache');
const openUrl = require('./helper/openUrl');

const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);

const tplPath = path.join(__dirname, './template/dir.tpl');
const source = fs.readFileSync(tplPath);
const template = handlebars.compile(source.toString());

class Server {
    constructor(config) {
        this.conf = Object.assign({}, conf, config);
    }

    start() {
        const server = http.createServer((req, res) => {
            const filePath = path.join(this.conf.root, req.url);
            (async () => {
                try {
                    const stats = await stat(filePath);
                    if (stats.isFile()) {
                        const contentType = mime(filePath);
                        res.setHeader('Content-Type', contentType);
        
                        if (isFresh(stats, req, res)) {
                            res.statusCode = 304;
                            res.end();
                            return;
                        }
        
                        let rs;
                        const {code, start, end} = range(stats.size, req, res);
                        if (code === 200) {
                            res.statusCode = 200;
                            rs = fs.createReadStream(filePath);
                        } else if (code === 206) {
                            res.statusCode = 206;
                            rs = fs.createReadStream(filePath,{start,end});
                        }
                        if (filePath.match(this.conf.compress)) {
                            rs = compress(rs, req, res);
                        }
                        rs.pipe(res);
                    } else if (stats.isDirectory()) {
                        const files = await readdir(filePath);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'text/html');
                        const dir = path.relative(this.conf.root, filePath)
                        const data = {
                            title: path.basename(filePath),
                            dir: dir ? `/${dir}` : '',
                            files
                        };
                        res.end(template(data));
                    }
                } catch (error) {
                    if(error) {
                        console.error(error);
                        res.statusCode = 404;
                        res.setHeader('Content-Type', 'text/plain');
                        res.end(`${filePath} is not a directory or file`);
                    }
                }
            })();
        });

        server.listen(this.conf.port, this.conf.hostname, () => {
            const addr = `http://${this.conf.hostname}:${this.conf.port}`;
            console.info(`Server started at ${chalk.green(addr)}`);
            openUrl(addr);
        });
    }
}

module.exports = Server;
