import { writeFile } from 'fs';
import { spawn } from 'child_process';

import * as fetch from 'isomorphic-fetch';
import * as cheerio from 'cheerio';

process.chdir('/home/link/Downloads/Anime');

(async () => {
    const res = await fetch('http://horriblesubs.info/rss.php?res=1080');
    const text = await res.text();
    const $ = cheerio.load(text, { xmlMode: true });

    const items =  $('item').map((idx, el) => {
        const title = $(el).find('title').text();
        const link = $(el).find('link').text();
        return { title, link };
    }).get();

    const file = await new Promise((resovle, reject) => {
        writeFile('link.txt', items.map(it => it.link).join('\n'), resovle);
    });

    const run = await new Promise((resolve, reject) => {
        const process = spawn(`aria2c`, [`--seed-time`, `0`, `-j`, `${items.length}`, `-i`, `link.txt`]);
        process.on('close', resolve);
        process.stdout.on('data', data => console.log(data.toString()));
        process.stderr.on('data', data => console.log(data.toString()));
    });

    console.log('Exited happily')
})()
    .catch(error => {
        console.log('Catch error', error);
    });