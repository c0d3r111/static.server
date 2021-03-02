import fs   from 'fs';
import zlib from 'zlib';

export default class Zipper {
    async compile(oldpath, newpath) {
        const data   = await this.read(oldpath);
        const zipped = await this.zip(data);

        if (!zipped) return false;

        void this.write(zipped, newpath);

        return zipped;
    }
    read(path) {
        return new Promise(resolve => {
            void fs.readFile(path, (err, content) => void resolve(err ? false : content));
        });
    }
    write(content, path) {
        return new Promise(resolve => {
            void fs.writeFile(path, content, resolve);
        });
    }
    zip(data) {
        return !data ? false : new Promise(resolve => {
            void zlib.gzip(data, (err, content) => void resolve(err ? false : content));
        });
    }
}
