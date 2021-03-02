import fs             from 'fs';
import http           from 'http';
import http2          from 'http2';
import Events         from './util.events.js';
import Intranet       from './server.local.js';
import mimes          from './server.mimes.js';
import ZipCompiler    from './server.zipper.js';

export default class StaticServer {
    constructor(config) {
        this._port        = config.port || 80;
        this._root        = config.root || "/root/public";
        this._host        = config.host;
        this._public      = config.public;
        this._apis        = new Map();
        this._emitter     = new Events();
        this._zipper      = new ZipCompiler();
        this._intranet    = new Intranet({
            port     : config.port_api || 3000,
            mediator : (data = {}) => void this._emitter.emit(data.id, data)
        });
        this._apitimeout  = 2500;

        void this.sethttp();
        void this.sethttps(config);
        void this.setapis(config.apis);
    }
    async routerhttp(request, response) {
        const url         = this.formaturl(request.url);
        const iscertcheck = await this.checkssl(url.path);

        return void (
            iscertcheck
                ? void this.respondcontent(response, url)
                : void this.respondredirect(response, request.url)
        );
    }
    async router(request, response) {
        const url = this.formaturl(request.url);

        return void (
            url.api
                ? this.respondapi(request, response, url)
                : url.query.production
                    ? this.respondzip(response, url)
                    : await this.checkfile(url.path)
                        ? this.respondcontent(response, url)
                        : this.responderror(response)
        );
    }
    async respondapi(request, response, url) {
        const message = {
            id    : this.uid(),
            body  : url.query.body ? await this.readbody(request) : false,
            query : url.query,
        };
        const race    = Promise.race([
            this.apitimeout(message.id),
            this.apiresponse(message.id, response)
        ]);

        void this._intranet.send(JSON.stringify(message), Number(url.api));

        return await race
            ? void 0
            : void response.end('timeout');
    }
    async respondzip(response, url) {
        const zippath = url.path + '.gz?' + url.query.production;
        const haszip  = await this.checkfile(zippath);

        if (haszip) {
            url.zip  = true;
            url.path = zippath;

            return void this.respondcontent(response, url);
        }

        const content = await this._zipper.compile(url.path, zippath);

        if (!content) {
            return void this.responderror(response);
        }

        void response.writeHead(200, this.getheaders(true, url.ext, this._cache));
        void response.end(content);
    }
    async setapis(file) {
        const data = await this.readfile(file);

        if (data) {
            void this._apis.clear();

            for (const entry of data.split(',')) {
                const [name, port] = entry.split(':');

                if (port) {
                    void this._apis.set(name, Number(port));
                }
            }

            return void setTimeout(
                () => void this.setapis(file),
                (Math.floor(Math.random() * 10) + 5 * 1e4)
            );
        }

        return;
    }

    apitimeout(id) {
        return new Promise(resolve => {
            void setTimeout(() => {
                void this._emitter.remove(id);
                void resolve(0);
            }, this._apitimeout);
        });
    }
    apiresponse(id, response) {
        return new Promise(resolve => {
            void this._emitter.on(id, data => {
                if (data.location) {
                    void response.writeHead(302, {'location': data.location});
                    void response.end();
                }
                if (data.headers) {
                    void response.writeHead(200, data.headers);
                }

                void (data.content
                    ? void response.end(JSON.stringify(data.content))
                    : void response.end());

                void resolve(1);
                void this._emitter.remove(id);
            });
        });
    }
    checkext(file) {
        const ext = file.split('.')[1];

        return ext in mimes ? ext : 'txt';
    }
    checkfile(path) {
        return new Promise(resolve => {
            void fs.access(path, err => void resolve(err ? false : true));
        });
    }
    checkssl(path) {
        return this._hascert
            ? false
            : path.startsWith(this._root + '/.well-known')
                ? this.checkfile(path)
                : false;
    }
    checkurl(url) {
        const furl = url.replace(/[\s<>]/, '');

        return furl.endsWith('/')
            ?  furl + 'index.html'
            :  furl.includes('.')
                ? furl
                : furl + '/index.html';
    }
    formaturl(url) {
        const furl    = decodeURI(url);
        const path    = this.checkurl(furl.split('?')[0]);
        const parts   = path.split('/');
        const obj     = {
            path  : this._root + path,
            query : this.getquery.call(this, furl)
        };

        if (parts[1] === 'api') {
            obj.api = this._apis.get(parts[2]) || false;
        }

        obj.ext = this.checkext(parts.pop());

        return obj;
    }
    getheaders(zip, ext, cache) {
        return {
            'content-encoding' : zip ? 'gzip' : '',
            'content-type'     : mimes[ext] || 'text/plain',
            'cache-control'    : 'public, max-age=' + (cache || 0),
        };
    }
    getquery(url) {
        const match  = url.match(/\?[^#]+/);
        const query  = {};

        if (match) {
            void match[0].slice(1).split('&').forEach(subject => {
                const [property, value] = subject.split('=');

                query[property] = value;

                return;
            });
        }

        return query;
    }
    readfile(file) {
        return new Promise(resolve => {
            void fs.readFile(file, (err, content) => void resolve(err ? false : content.toString()));
        });
    }
    readbody(request) {
        return new Promise(resolve => {
            const data = [];

            void request.on('data', chunk => void data.push(chuck));
            void request.on('end',  ()    => void resolve(data.join('')));
        });
    }
    respondcontent(response, url) {
        const reader = fs.createReadStream(url.path);

        void response.writeHead(200, this.getheaders(url.zip, url.ext, this._cache));
        void reader.pipe(response);
        void reader.on('errror', () => void response.end());
        void reader.on('end',    () => void response.end());
    }
    responderror(response) {
        void response.writeHead(404, {'cache-control': 'public, max-age=360'});
        void response.end();

        return;
    }
    respondredirect(response, path) {
        void response.writeHead(302, {'location': 'https://' + this._host + path});
        void response.end();

        return;
    }
    sethttp() {
        this._server = http.createServer(this[this._public ? 'routerhttp' : 'router'].bind(this));

        return void this._server.listen(this._port || 80);
    }
    sethttps(config) {
        if (!config.cert) return;

        this._hascert      = true;
        this._secureserver = http2.createSecureServer({
            cert       : fs.readFileSync(config.cert),
            key        : fs.readFileSync(config.key),
            allowHTTP1 : true,
        }, this.router.bind(this));

        return void this._secureserver.listen(443);
    }
    uid() {
        return String.fromCharCode(Math.floor(Math.random() * 26) + 97)
             + Math.random().toString(16)
             + String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    }
}
