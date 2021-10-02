const puppeteer = require('puppeteer');
const shufflefy = require('shufflefy');
const template = require('art-template')
const http = require('http');
const fs = require('fs');
const { resolve } = require('path');
const { url } = require('inspector');

class Tool {
    static getQueryParams(url) {
        return Object.fromEntries(new URLSearchParams(url.split("?")[1]).entries());
    }
    static randomPageNum(max) {
        return Math.floor(Math.random() * max);
    }
}

const NUM = 20;
/**
 *  每个来源出20张，多的放入缓存减少请求次数.
 *  (因此会有换了关键词却还是上次的图片问题...)
 */
// ============================ 爬虫们
class Baidu {
    default = '高清壁纸' // 默认关键词
    goodPage = 100 // 前150页为优秀页
    totalPage = 10 // 用于计算页数
    size = 30
    baseUrl = 'https://image.baidu.com/search/acjson'
    queryParams = ''
    cache = []

    static async bulide() {
        return await new Promise(async (resolve, reject) => {
            let baidu = new Baidu();
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.goto('https://image.baidu.com/');
            await page.$eval('#kw', kw => kw.value = '新垣结衣');
            await Promise.all([
                page.waitForNavigation(),
                page.click('#homeSearchForm > span.s_btn_wr > input')
            ]);
            page.on('request', logRequest);
            await page.evaluate(() => {
                return new Promise(resolve => {
                    window.scrollTo(0, window.scrollY + 10);
                    resolve();
                });
            });
            async function logRequest(interceptedRequest) {
                let url = interceptedRequest.url();
                if (url.includes(baidu.baseUrl)) {
                    baidu.queryParams = Tool.getQueryParams(url);
                    page.off('request', logRequest);
                    browser.close();
                    resolve(baidu);
                }
            }
        });
    }

    url(word) {
        this.queryParams['word'] = word || this.default;
        this.queryParams['pn'] = Tool.randomPageNum(this.totalPage) * this.size;
        return `${this.baseUrl}?${new URLSearchParams(this.queryParams)}`;
    }

    async spider(word) {
        if (this.cache.length >= 20) {
            console.log('Baidu', 'get cache', this.cache.length)
            return this.cache.splice(0, Math.min(NUM, this.cache.length));
        }
        try {
            console.log('Baidu', '执行查询');
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.goto(this.url(word));
            let res = await page.$eval('body', body => JSON.parse(body.textContent));
            browser.close();
            let count = res.bdFmtDispNum.replace(/[约,]/g, '');
            this.totalPage = count/this.size%this.goodPage;
            let images = res.data.map(data => {
                    return {
                        src: data.thumbURL,
                        alt: data.fromPageTitleEnc
                    }
            }).filter(images => images.src != undefined);
            this.cache.push(...images.splice(0, images.length - NUM));
            return images;
        } catch(err) {
            return [];
        }
    }
}

class Souhu {
    default = '高清壁纸' // 默认关键词
    goodPage = 100 // 前150页为优秀页
    totalPage = 10 // 用于计算页数
    size = 48
    baseUrl = 'https://pic.sogou.com/napi/pc/searchList'
    queryParams = ''
    cache = []

    static async bulide() {
        let souhu = new Souhu();
        let example = 'https://pic.sogou.com/napi/pc/searchList?mode=1&start=48&xml_len=48&query=%E6%96%B0%E5%9E%A3%E7%BB%93%E8%A1%A3';
        souhu.queryParams = Tool.getQueryParams(example);
        return souhu;
    }

    url(word) {
        this.queryParams['query'] = word || this.default;
        this.queryParams['start'] = Tool.randomPageNum(this.totalPage) * this.size;
        return `${this.baseUrl}?${new URLSearchParams(this.queryParams)}`;
    }

    async spider(word) {
        if (this.cache.length >= 20) {
            console.log('Souhu', 'get cache', this.cache.length)
            return this.cache.splice(0, Math.min(NUM, this.cache.length));
        }
        try {
            console.log('Souhu', '执行查询');
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.goto('https://pic.sogou.com/');
            let res = await page.evaluate((url) => {
            return fetch(url).then(res => res.json());
            }, this.url(word))
            browser.close();
            this.totalPage = res.data.totalNum/this.size%this.goodPage;
            let images = res.data.items.map(data => {
                    return {
                        src: data.oriPicUrl,
                        alt: data.title
                    }
            });
            this.cache.push(...images.splice(0, images.length - NUM));
            return images;
        } catch(err) {
            return []
        }
    }
}

class QuanJing {
    default = '风景' // 默认关键词
    goodPage = 100 // 前100页为优秀页
    totalPage = 10 // 用于计算页数
    size = 100
    baseUrl = 'https://www.quanjing.com/Handler/SearchUrl.ashx'
    queryParams = ''
    cache = []

    static async bulide() {
        let quanjing = new QuanJing();
        let example = 'https://www.quanjing.com/Handler/SearchUrl.ashx?t=7180&callback=searchresult&q=%E5%8A%A8%E6%BC%AB&stype=1&pagesize=100&pagenum=1&imageType=2&imageColor=&brand=&imageSType=&fr=1&sortFlag=1&imageUType=&btype=&authid=&_=1633083694148';
        quanjing.queryParams = Tool.getQueryParams(example);
        return quanjing;
    }

    url(word) {
        this.queryParams['q'] = word || this.default;
        this.queryParams['pagenum'] = Tool.randomPageNum(this.totalPage);
        return `${this.baseUrl}?${new URLSearchParams(this.queryParams)}`;
    }

    async spider(word) {
        if (this.cache.length >= 20) {
            console.log('QuanJing', 'get cache', this.cache.length)
            return this.cache.splice(0, Math.min(NUM, this.cache.length));
        }
        try {
            console.log('QuanJing', '执行查询');
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.goto('https://www.quanjing.com/');
            let res = await page.evaluate((url) => {
            return fetch(url).then(res => res.text());
            }, this.url(word))
            res = JSON.parse(res.match(/searchresult\((.*)\)/)[1])
            browser.close();
            // 直接提供了总页数
            this.totalPage = res.pagecount%this.goodPage;
            let images = res.imglist.map(data => {
                    return {
                        src: data.imgurl,
                        alt: data.caption
                    }
            });
            this.cache.push(...images.splice(0, images.length - NUM));
            return images;
        } catch(err) {
            return []
        }
    }
}


let baiduSpider;
let quanjingSpider;
let souhuSpider;

(async () => {
    baiduSpider = await Baidu.bulide();
    quanjingSpider = await QuanJing.bulide();
    souhuSpider = await Souhu.bulide();
    console.log('Are you ready!')
})()

let last = new Date().getTime();
http.createServer(async (req, res) => {
    if (req.url.includes('favicon')) {
        res.end(fs.readFileSync('./favicon.ico'))
        return;
    }
    let params = Tool.getQueryParams(req.url);
    let images = [];
    // 不能请求太快
    let now = new Date().getTime()
    if (now > last + 2000) {
        last = now;
        console.log(`${new Date().toLocaleString()} ${params.w}`);
        images.push( ...await baiduSpider.spider(params.w));
        images.push( ...await quanjingSpider.spider(params.w));
        images.push( ...await souhuSpider.spider(params.w));
    }
    let html = fs.readFileSync('./index.html')
    let body = template.render(html.toString(), {images: shufflefy(images)});
    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end(body)
}).listen(3003);



