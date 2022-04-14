const fs = require('fs');
const node_fetch  = require('node-fetch');


async function getStockData(stock_name) {
    try {
        // to replace all & with %26
        const stock = String(stock_name).replace(/&/g, '%26');
        // console.log(stock);
        let INST = '';
        if (stock == 'NIFTY' || stock == 'BANKNIFTY' || stock == 'FINNIFTY') {
            INST = 'indices';
        }
        else {
            INST = 'equities';
        }
        console.log('before')
        console.log(fetch);
        
        const response = await node_fetch.fetch(`https://www.nseindia.com/api/option-chain-${INST}?symbol=${stock}`);
        const data = await response.json();
        // const response = await axios.get(`https://www.nseindia.com/api/option-chain-${INST}?symbol=${stock}`)
        console.log('after')
        // const data = response.data;
        data['meta'] = {};
        data['meta']['StockName'] = stock;
        data['meta']['INST'] = INST;

        fs.writeFileSync(`stock3.json`, JSON.stringify(data));
        return data;
    }
    catch (error) {
        console.log(error);
    }

}
getStockData('NIFTY');