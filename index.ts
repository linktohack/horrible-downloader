import { writeFile, appendFile, readFile, createWriteStream } from 'fs';
import { spawn } from 'child_process';

import * as fetch from 'isomorphic-fetch';
import * as cheerio from 'cheerio';

const DIR = '/home/link/Downloads/Anime';
const BLACKLISTS = [
    // Winter 2017
    '100% Pascal-sensei',
    '3-gatsu no Lion',
    'Animegataris',
    'Ballroom e Youkoso',
    'Boruto - Naruto Next Generations',
    'Cardfight!! Vanguard G Z',
    'Detective Conan',
    'Dragon Ball Super',
    'Dynamic Chord',
    'IDOLiSH7',
    'Juuni Taisen',
    'Gintama',
    'One Piece',
    'Onyankopon',
    'Ousama Game',
    'Puzzle and Dragons Cross',
    'THE iDOLM@STER CINDERELLA GIRLS Theater (TV)',
    'THE iDOLM@STER CINDERELLA GIRLS Theater (Web)',
    'The iDOLM@STER Side M',
    'Tsukipro The Animation',
    'Two Car',
    'Wake Up, Girls! Shin Shou',
    'Youkai Apartment no Yuuga na Nichijou',
    'Yu-Gi-Oh! VRAINS',
    'Folktales from Japan S2',
];

process.chdir(DIR);
console.log(`Switched to ${process.cwd()}`);

(async () => {
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
            const matched = title.match(/\[HorribleSubs\] (.*) - [0-9]/);
            let show = '.'
            if (matched) {
                show = matched[1];
            }
            const link = $(el).find('link').text();
            return { title, show, link };
        })
        .get() as any;

    const completed = await new Promise<string[]>((resolve, reject) => {
        readFile('link-completed.txt', (err, data) => {
            if (err) {
                return resolve([]);
            }
            return resolve(data.toString().split('\n'));
        })
    });

    const filteredItems = items
        .filter(it => BLACKLISTS.indexOf(it.show) === -1)
        .filter(it => completed.indexOf(it.link) === -1);

    console.log(`File to download: ${filteredItems.map(it => `\n  ${it.title}`).join('')}`);

    await new Promise((resolve, reject) => {
        writeFile('link.txt', filteredItems.map(it => `${it.link}\n dir=${it.show}`).join('\n'), resolve);
    });

    await new Promise((resolve, reject) => {
        const process = spawn('aria2c', ['-c', '--seed-time', '0', '-j', `${items.length}`, '-i', 'link.txt']);
        process.on('close', (code) => {
            (code === 0 || code === 13) ? resolve(code) : reject(code); // 13: file already existed
        });
        process.stdout.pipe(createWriteStream('link-stdout.txt', {flags: 'a'}));
        process.stderr.pipe(createWriteStream('link-stderr.txt', {flags: 'a'}));
    });

    await new Promise((resolve, reject) => {
        appendFile('link-completed.txt', filteredItems.map(it => `${it.link}\n`).join(''), resolve);
    });

    console.log('Exited happily!');
})()
    .catch(error => {
        console.log('Caught error:', error);
    });