import { writeFile } from 'fs';
import { spawn } from 'child_process';

import * as fetch from 'isomorphic-fetch';
import * as cheerio from 'cheerio';

const DIR = '/home/link/Downloads/Anime';
const BLACKLISTS = [
    '100% Pascal-sensei',
    'Cardfight!! Vanguard G Z',
    'Boruto - Naruto Next Generations',
    'Detective Conan',
    'Dragon Ball Super',
    'IDOLiSH7',
    'Juuni Taisen',
    'THE iDOLM@STER CINDERELLA GIRLS Theater (TV)',
    'THE iDOLM@STER CINDERELLA GIRLS Theater (Web)',
    'The iDOLM@STER Side M',
    'Yu-Gi-Oh! VRAINS',
]

console.log(`switched to ${DIR}`);
process.chdir(DIR);

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

    const filteredItems = items.filter(it => BLACKLISTS.indexOf(it.show) === -1);

    await new Promise((resovle, reject) => {
        writeFile('link.txt', filteredItems.map(it => `${it.link}\n dir=${it.show}`).join('\n'), resovle);
    });

    await new Promise((resolve, reject) => {
        const process = spawn(`aria2c`, [`--seed-time`, `0`, `-j`, `${items.length}`, `-i`, `link.txt`]);
        process.on('close', resolve);
        process.stdout.on('data', data => console.log(data.toString()));
        process.stderr.on('data', data => console.log(data.toString()));
    });

    console.log('Exited happily!')
})()
    .catch(error => {
        console.log('Caught error:', error);
    });