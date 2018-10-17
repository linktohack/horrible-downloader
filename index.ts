import { appendFile, createWriteStream, readFile, writeFile } from 'fs';
import { isAbsolute, join } from 'path';
import { spawn } from 'child_process';

import * as fetch from 'isomorphic-fetch';
import * as cheerio from 'cheerio';

const DIR = process.env.DIR;
const PREFIX = process.env.PREFIX || 'cached/horrible-';

async function readFileAsNonBlankLinesAsync(filename: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        readFile(filename, (err, data) => {
            if (err) {
                return resolve([]);
            }
            return resolve(data.toString().split('\n').filter(it => it && !/^\s*#/.test(it)));
        });
    });
}

async function writeFileAsync(filename: string, data: string): Promise<{}> {
    return new Promise((resolve, reject) => {
        writeFile(filename, data, resolve);
    });
}

(async () => {
    spawn('touch', [`${PREFIX}blacklist.txt`]);
    spawn('touch', [`${PREFIX}whitelist.txt`]);

    const res = await fetch('http://horriblesubs.info/rss.php?res=1080');
    const text = await res.text();
    const $ = cheerio.load(text, { xmlMode: true });

    const items: {
        title: string,
        show: string,
        link: string
    }[] = $('item')
        .map((idx, el) => {
            const title = $(el).find('title').text();
            const matched = title.match(/\[HorribleSubs] (.*) - [0-9]/);
            let show = '.';
            if (matched) {
                show = matched[1];
            }
            const link = $(el).find('link').text();
            return { title, show, link };
        })
        .get() as any;

    const completed = await readFileAsNonBlankLinesAsync(`${PREFIX}completed.txt`);
    const blacklist = await readFileAsNonBlankLinesAsync(`${PREFIX}blacklist.txt`);
    const whitelist = await readFileAsNonBlankLinesAsync(`${PREFIX}whitelist.txt`);

    blacklist.forEach(dir => {
        spawn('rm', ['-rf', dir], { cwd: DIR });
    });

    const filteredItems = items
        .filter(it => whitelist.length === 0 || whitelist.indexOf(it.show) > -1)
        .filter(it => blacklist.indexOf(it.show) === -1)
        .filter(it => completed.indexOf(it.link) === -1);

    console.log(`All files: ${items.map(it => `\n  ${it.title}`).join('')}`);
    console.log(`Files to download: ${filteredItems.map(it => `\n  ${it.title}`).join('')}`);

    await writeFileAsync(`${PREFIX}current-shows.txt`, filteredItems.map(it => it.show).join('\n'));
    await writeFileAsync(`${PREFIX}to-download.txt`, filteredItems.map(it => `${it.link}\n dir=${it.show}`).join('\n'));

    await new Promise((resolve, reject) => {
        const toDownload = `${PREFIX}to-download.txt`;
        const childProcess = spawn('aria2c', [
            '-c',
            '--seed-time', '0',
            '-j', `${items.length}`,
            '-i', isAbsolute(toDownload) ? toDownload : join(process.cwd(), toDownload)
        ], { cwd: DIR });
        childProcess.on('close', (code) => (code === 0 || code === 13) ? resolve(code) : reject(code)); // 13: file already existed
        childProcess.on('error', reject);
        childProcess.stdout.pipe(createWriteStream(`${PREFIX}stdout.txt`, { flags: 'a' }));
        childProcess.stderr.pipe(createWriteStream(`${PREFIX}stderr.txt`, { flags: 'a' }));
    });

    await new Promise((resolve, reject) => {
        appendFile(`${PREFIX}completed.txt`, filteredItems.map(it => `${it.link}\n`).join(''), resolve);
    });

    console.log('Exited happily!');
})()
    .catch(error => {
        console.error('Error caught:', error);
    });