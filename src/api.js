const express = require('express');
const serverless = require('serverless-http');

const axios = require('axios')

const app = express();

const router = express.Router();

router.get('/', (req, res) => {

    res.json({
        hello: 'hii'
    })
})

router.get('/nse_data', (req, res) => {

    try {

        // console.log('req.query', req);
        const headers = {
            host: 'www.nseindia.com',
            connection: 'keep-alive',
            'cache-control': 'max-age=0',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'sec-fetch-site': 'none',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
            cookie: 'cookieconsent_status=dismiss; username-localhost-8888="2|1:0|10:1648046166|23:username-localhost-8888|44:YWM3NDI3ZTYxZjRmNDRiM2JlMzNlYjVkZDllMDk4MmE=|eea8805abb481d34b46a456ed1a5e14156d0192a902ecc651c290e770b84673e"; _xsrf=2|8a7adbfd|b193fbbc975c40e1a2234632badb0326|1648046166',
            'if-none-match': 'W/"20-CMFHHhSdxEAtR/GNmFCOPJIHWrg"'
        };

        const data = axios.get('https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY', { headers: headers })
            .then(data => {
                // console.log('got data', data)
                res.json({ got: 'got-data', 'data': data.data })
            }).catch(err => {
                // console.log('got error', err);
                res.json({ got: 'error', err: err })
            })
        // if (data.status === 200) {
        // }
        // else {
        //     res.send('data not received from nse')
        // }
    }
    catch (err) {
        console.log(err);
        res.send('got error in catch block for nse')
    }
})

router.get('/placeholder_data', async (req, res) => {

    try {

        const data = await axios.get('https://jsonplaceholder.typicode.com/posts');
        if (data.status === 200) {
            res.json(data.data);
        }
        else {
            res.send('data not received from jsonplaceholder')
        }
    }
    catch (err) {
        console.log(err);
        res.send('got error in catch block for jsonplaceholder')
    }
})

app.use('/.netlify/functions/api', router); // path must route to lambda

module.exports.handler = serverless(app);