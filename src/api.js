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

        const data = axios.get('https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY')
        .then(data => {
            res.json(data.data)
        }).catch(err => {
            res.json(err)
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