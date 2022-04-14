const axios = require('axios')

async function getData() {
    try {
        const data = await axios.get('https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY');
        console.log(data.data);
    } catch (error) {
        console.log('error');
    }
}

getData();