const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { utcToZonedTime } = require('date-fns-tz');
const mysql = require('mysql');


// function getUrlData(url) {
//     return axios.get(url)
//         .then(response => {
//             return response.data;
//         })
//         .catch(error => {
//             console.log(error);
//         });
// }

function stdNormal(x, mu = 0, sigma = 1) {
    const z = (x - mu) / sigma;
    let j, k, kMax, m, values, total, subtotal, item, z2, z4, a, b;

    // Power series is not stable at these extreme tail scenarios
    if (z < -6) { return 0; }
    if (z > 6) { return 1; }

    m = 1;        // m(k) == (2**k)/factorial(k)
    b = z;        // b(k) == z ** (2*k + 1)
    z2 = z * z;    // cache of z squared
    z4 = z2 * z2;  // cache of z to the 4th
    values = [];

    // Compute the power series in groups of two terms.
    // This reduces floating point errors because the series
    // alternates between positive and negative.
    for (k = 0; k < 100; k += 2) {
        a = 2 * k + 1;
        item = b / (a * m);
        item *= (1 - (a * z2) / ((a + 1) * (a + 2)));
        values.push(item);
        m *= (4 * (k + 1) * (k + 2));
        b *= z4;
    }

    // Add the smallest terms to the total first that
    // way we minimize the floating point errors.
    total = 0;
    for (k = 49; k >= 0; k--) {
        total += values[k];
    }

    // Multiply total by 1/sqrt(2*PI)
    // Then add 0.5 so that stdNormal(0) === 0.5
    return 0.5 + 0.3989422804014327 * total;
}

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
        const response = await axios.get(`http://www.nseindia.com/api/option-chain-${INST}?symbol=${stock}`)
        console.log(response.data);
        const data = response.data;
        data['meta'] = {};
        data['meta']['StockName'] = stock;
        data['meta']['INST'] = INST;
        
        fs.writeFileSync(`stock4.json`, JSON.stringify(data));
        return data;
    }
    catch (error) {
        console.log(error);
    }

}

function round(value, precision) {
    let multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
}

function* parseStockData(data) {
    const days_for_expiry = 5;
    const expiryDates = data['records']['expiryDates'];

    const zonedDate = utcToZonedTime(new Date(), 'Asia/Kolkata');
    const todayDay = zonedDate.getDay();

    let expiryDate = [];
    //4 four means thursday
    // 0 sunday, 1 monday, 2 tuesday, 3 wednesday, 4 thursday, 5 friday, 6 saturday 
    if (todayDay === 4) {
        expiryDate = expiryDates[1];
    }
    else {
        expiryDate = expiryDates[0];
    }

    let a_id = '';
    // const data = data;
    const records = data['records'];
    const filtered = data['filtered'];
    const StockName = data['meta']['StockName'];

    const arr_str_prc = [];
    const arr_call_oi = [];
    const arr_call_net_chng = [];
    const arr_call_chng_oi = [];
    const arr_call_vol = [];
    const arr_call_iv = [];
    const arr_call_ltp = [];
    const arr_put_oi = [];
    const arr_put_chng_oi = [];
    const arr_put_vol = [];
    const arr_put_iv = [];
    const arr_put_ltp = [];

    let CallTotalOI = 0;
    let CallTotalVolume = 0;
    let PutTotalOI = 0;
    let PutTotalVolume = 0;
    let VIX = 0;

    for (let i = 0; i < records['data'].length; i++) {

        if (records['data'][i]['expiryDate'] === expiryDate) {

            let SpotPrice = '';
            if (records['underlyingValue']) {
                SpotPrice = records['underlyingValue'];
            }
            let date = '';
            if (records['timestamp'].split(' ')[0]) {
                date = records['timestamp'].split(' ')[0];
            }
            let time = '';
            if (records['timestamp'].split(' ')[1]) {
                time = records['timestamp'].split(' ')[1];
            }

            CallTotalOI = Number(filtered['CE']['totOI']);
            CallTotalVolume = Number(filtered['CE']['totVol']);
            PutTotalOI = Number(filtered['PE']['totOI']);
            PutTotalVolume = Number(filtered['PE']['totVol']);
            VIX = '';

            let CallOI = '-';
            if (records['data'][i]['CE']['openInterest']) {
                CallOI = records['data'][i]['CE']['openInterest'];
            }
            let CallChangeOI = '-';
            if (records['data'][i]['CE']['changeinOpenInterest']) {
                CallChangeOI = records['data'][i]['CE']['changeinOpenInterest'];
            }
            let CallVol = '-';
            if (records['data'][i]['CE']['totalTradedVolume']) {
                CallVol = records['data'][i]['CE']['totalTradedVolume'];
            }
            let CallIV = '-';
            if (records['data'][i]['CE']['impliedVolatility']) {
                CallIV = records['data'][i]['CE']['impliedVolatility'];
            }
            let CallLTP = '-';
            if (records['data'][i]['CE']['lastPrice']) {
                CallLTP = records['data'][i]['CE']['lastPrice'];
            }
            let CallNetChng = '-';
            if (records['data'][i]['CE']['change']) {
                CallNetChng = records['data'][i]['CE']['change'];
            }

            let StrikePrice = '-';
            if (records['data'][i]['CE']['strikePrice']) {
                StrikePrice = records['data'][i]['CE']['strikePrice'];
            }
            else {
                if (records['data'][i]['PE']['strikePrice']) {
                    StrikePrice = records['data'][i]['PE']['strikePrice'];
                }
            }
            let PutNetChange = '-';
            if (records['data'][i]['PE']['change']) {
                PutNetChange = records['data'][i]['PE']['change'];
            }
            let PutIV = '-';
            if (records['data'][i]['PE']['impliedVolatility']) {
                PutIV = records['data'][i]['PE']['impliedVolatility'];
            }
            let PutLTP = '-';
            if (records['data'][i]['PE']['lastPrice']) {
                PutLTP = records['data'][i]['PE']['lastPrice'];
            }
            let PutVol = '-';
            if (records['data'][i]['PE']['totalTradedVolume']) {
                PutVol = records['data'][i]['PE']['totalTradedVolume'];
            }
            let PutChangeOI = '-';
            if (records['data'][i]['PE']['changeinOpenInterest']) {
                PutChangeOI = records['data'][i]['PE']['changeinOpenInterest'];
            }
            let PutOI = '-';
            if (records['data'][i]['PE']['openInterest']) {
                PutOI = records['data'][i]['PE']['openInterest'];
            }

            CallOI = String(CallOI).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== CallOI) {
                CallOI = round(Number(CallOI), 2);
            } else {
                CallOI = 0;
            }
            arr_call_oi.push(CallOI);

            CallChangeOI = String(CallChangeOI).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if (CallChangeOI !== '-') {
                CallChangeOI = round(Number(CallChangeOI), 2);
            }
            else {
                CallChangeOI = 0;
            }
            arr_call_chng_oi.push(CallChangeOI);

            CallVol = String(CallVol).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== CallVol) {
                CallVol = round(Number(CallVol), 2);
            }
            else {
                CallVol = 0;
            }
            arr_call_vol.push(CallVol);

            CallIV = String(CallIV).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== CallIV) {
                CallIV = round(Number(CallIV), 2);
            }
            else {
                CallIV = 0;
            }
            arr_call_iv.push(CallIV);

            CallLTP = String(CallLTP).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== CallLTP) {
                CallLTP = round(Number(CallLTP), 2);
            }
            else {
                CallLTP = 0;
            }
            arr_call_ltp.push(CallLTP);

            CallNetChng = String(CallNetChng).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== CallNetChng) {
                CallNetChng = round(Number(CallNetChng), 2);
            }
            else {
                CallNetChng = 0;
            }
            arr_call_net_chng.push(CallNetChng);

            StrikePrice = String(StrikePrice).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== StrikePrice) {
                StrikePrice = round(Number(StrikePrice), 2);
            }
            else {
                StrikePrice = 0;
            }
            arr_str_prc.push(StrikePrice);

            PutNetChange = String(PutNetChange).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutNetChange) {
                PutNetChange = round(Number(PutNetChange), 2);
            }
            else {
                PutNetChange = 0;
            }

            PutIV = String(PutIV).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutIV) {
                PutIV = round(Number(PutIV), 2);
            }
            else {
                PutIV = 0;
            }
            arr_put_iv.push(PutIV);

            PutLTP = String(PutLTP).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutLTP) {
                PutLTP = round(Number(PutLTP), 2);
            }
            else {
                PutLTP = 0;
            }
            arr_put_ltp.push(PutLTP);

            PutVol = String(PutVol).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutVol) {
                PutVol = round(Number(PutVol), 2);
            }
            else {
                PutVol = 0;
            }
            arr_put_vol.push(PutVol);

            PutChangeOI = String(PutChangeOI).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutChangeOI) {
                PutChangeOI = round(Number(PutChangeOI), 2);
            }
            else {
                PutChangeOI = 0;
            }
            arr_put_chng_oi.push(PutChangeOI);

            PutOI = String(PutOI).replace(/,/g, '').replace(/-/g, '').replace(/ /g, '');
            if ('-' !== PutOI) {
                PutOI = round(Number(PutOI), 2);
            }
            else {
                PutOI = 0;
            }
            arr_put_oi.push(PutOI);

            let item = {};

            const q = date.trim() + time.split(':').slice(0, 2).join(':') + StockName + expiryDate.trim();
            const a = Buffer.from(q, 'utf-8');

            const md5sum = crypto.createHash('md5').update(a);
            const md5val = md5sum.digest('hex');
            const hex = parseInt(md5val, 16);
            a_id = hex % (10 ** 11);

            item['item_type'] = 'item1';
            item['master_entry_id'] = a_id;
            item['master_entry_id_fk'] = a_id;
            item['stock_name'] = StockName.trim();
            item['spot_price'] = SpotPrice;
            item['start_date'] = date.trim();
            item['start_time'] = time.trim();
            item['expiry_date'] = expiryDate.trim();
            item['created_at'] = '';
            item['updated_at'] = '';
            item['VIX'] = VIX;
            item['calls_oi'] = CallOI;
            item['calls_change_oi'] = CallChangeOI;
            item['calls_volume'] = CallVol;
            item['calls_iv'] = CallIV;
            item['calls_net_chng'] = CallNetChng;
            item['call_ltp'] = CallLTP;
            item['strike_price'] = StrikePrice;
            item['put_net_chng'] = PutNetChange;
            item['put_iv'] = PutIV;
            item['put_volume'] = PutVol;
            item['put_chng_oi'] = PutChangeOI;
            item['put_ltp'] = PutLTP;
            item['put_oi'] = PutOI;
            item['call_total_oi'] = CallTotalOI;
            item['call_total_volume'] = CallTotalVolume;
            item['put_total_oi'] = PutTotalOI;
            item['put_total_volume'] = PutTotalVolume;

            const q2 = date.trim() + time.split(':').slice(0, 2).join(':') + StockName + String(records['underlyingValue']) + String(StrikePrice) + expiryDate.trim();
            const a2 = Buffer.from(q2, 'utf-8');
            const md5sum2 = crypto.createHash('md5').update(a2);
            const md5val2 = md5sum2.digest('hex');
            const hex2 = parseInt(md5val2, 16);
            const a_id2 = hex2 % (10 ** 11);
            item['slave_entry_id'] = a_id2;
            yield item;
        }
    }

    let item = {};
    item['item_type'] = 'item2';

    const getMin1 = (arr, spot_price) => {
        const filter_arr = arr.filter(x => x > spot_price);
        const abs_arr = filter_arr.map(x => Math.abs(x - spot_price));
        return Math.min(...abs_arr);
    }
    const getMin2 = (arr, spot_price) => {
        const filter_arr = arr.filter(x => x < spot_price);
        const abs_arr = filter_arr.map(x => Math.abs(x - spot_price));
        return Math.min(...abs_arr);
    }

    const arr_str_prc_length = arr_str_prc.length;

    let SpotPrice = '';
    const ATM_call = getMin1(arr_str_prc, SpotPrice);
    const ATM_put = getMin2(arr_str_prc, SpotPrice);

    const ATM_call_index = arr_str_prc.indexOf(ATM_call);
    const ATM_put_index = arr_str_prc.indexOf(ATM_put);

    const ATM_call_iv = arr_call_iv[ATM_call_index];
    const ATM_put_iv = arr_put_iv[ATM_put_index];

    let six_call_iv_sum = 0;
    let six_put_iv_sum = 0;
    let cant_compare = 0;

    for (let i = ATM_call_index - 3; i < ATM_call_index + 3; i++) {
        if (arr_call_iv[i] === '-' || arr_call_iv[i] === 0) {
            cant_compare = 1;
            break;
        }
        else {
            six_call_iv_sum = six_call_iv_sum + arr_call_iv[i];
        }
    }

    for (let i = ATM_put_index - 2; i < ATM_put_index + 4; i++) {
        if (arr_put_iv[i] === '-' || arr_put_iv[i] === 0) {
            cant_compare = 1;
            break;
        }
        else {
            six_put_iv_sum = six_put_iv_sum + arr_put_iv[i];
        }
    }

    if (cant_compare === 1) {
        console.log('Cant Compare IV because one of the element is zero')
    }
    else if (six_call_iv_sum > six_put_iv_sum) {
        console.log('Bull : IV sum of 6 suggests a Bear market. Sum IV of Six for Call is ' + six_call_iv_sum + ' And Sum IV of Six for Put is ' + six_put_iv_sum)
    }
    else {
        console.log('Bear : IV sum of 6 suggests a Bull market. Sum IV of Six for Call is ' + six_call_iv_sum + ' And Sum IV of Six for Put is ' + six_put_iv_sum)
    }

    item['six_call_iv_sum'] = six_call_iv_sum;
    item['six_put_iv_sum'] = six_put_iv_sum;

    six_call_ltp = 0;
    six_put_ltp = 0;
    cant_compare = 0;

    for (let i = ATM_call_index - 3; i < ATM_call_index + 3; i++) {
        if (arr_call_ltp[i] === '-' || arr_call_ltp[i] === 0) {
            cant_compare = 1;
            break;
        }
        else {
            six_call_ltp = six_call_ltp + arr_call_ltp[i];
        }
    }

    for (let i = ATM_put_index - 2; i < ATM_put_index + 4; i++) {
        if (arr_put_ltp[i] === '-' || arr_put_ltp[i] === 0) {
            cant_compare = 1;
            break;
        }
        else {
            six_put_ltp = six_put_ltp + arr_put_ltp[i];
        }
    }

    if (cant_compare === 1) {
        console.log('Cant Compare LTP because one of the element is zero')
    }
    else if (six_call_ltp > six_put_ltp) {
        console.log('Bull : LTP of 6 suggests a Bear market. Sum of Six LTP for Call is ' + six_call_ltp + ' And Sum of Six LTP for Put is ' + six_put_ltp)
    }
    else {
        console.log('Bear : LTP of 6 suggests a Bull market. Sum of Six LTP for Call is ' + six_call_ltp + ' And Sum of Six LTP for Put is ' + six_put_ltp)
    }

    const arr_ITM_call_OI = [];
    const arr_ITM_call_chng_in_OI = [];
    const arr_ITM_call_vol = [];

    const arr_ITM_put_OI = [];
    const arr_ITM_put_chng_in_OI = [];
    const arr_ITM_put_vol = [];

    const arr_OTM_call_OI = [];
    const arr_OTM_call_chng_in_OI = [];
    const arr_OTM_call_vol = [];

    const arr_OTM_put_OI = [];
    const arr_OTM_put_chng_in_OI = [];
    const arr_OTM_put_vol = [];

    for (let i = ATM_call_index; i < arr_str_prc.length; i++) {
        arr_OTM_call_OI.push(arr_call_oi[i]);
        arr_OTM_call_chng_in_OI.push(arr_call_chng_oi[i]);
        arr_OTM_call_vol.push(arr_call_vol[i]);
        arr_ITM_put_OI.push(arr_put_oi[i]);
        arr_ITM_put_chng_in_OI.push(arr_put_chng_oi[i]);
        arr_ITM_put_vol.push(arr_put_vol[i]);
    }

    for (let i = 0; i < ATM_put_index + 1; i++) {
        arr_OTM_put_OI.push(arr_put_oi[i]);
        arr_OTM_put_chng_in_OI.push(arr_put_chng_oi[i]);
        arr_OTM_put_vol.push(arr_put_vol[i]);
        arr_ITM_call_OI.push(arr_call_oi[i]);
        arr_ITM_call_chng_in_OI.push(arr_call_chng_oi[i]);
        arr_ITM_call_vol.push(arr_call_vol[i]);
    }

    const put_neg_count = arr_ITM_put_chng_in_OI.filter(x => x < 0).length;
    const call_neg_count = arr_ITM_call_chng_in_OI.filter(x => x < 0).length;
    let neative_count = '';
    if (put_neg_count > call_neg_count) {
        negative_count = "Bear : Negative count more ITM Put"
        console.log('Bear : Negative count more ITM Put. ' + put_neg_count + ' Put Postions are getting Squared Off compared to Call ' + call_neg_count)
    }
    else if (put_neg_count < call_neg_count) {
        negative_count = "Bull : Negative count more ITM Call"
        console.log('Bull : Negative count is more in Call ' + call_neg_count + ' than Put count ' + put_neg_count)
    }
    else {
        negative_count = "Neutral :Negative count is same in Put and Call"
        console.log('Neutral : Negative count same ITM Call and PUT')
    }

    // Logic for max pain for call
    let arr_max_pain_call = [];
    let arr_max_pain_put = [];
    let arr_max_pain_call_str_prc = [];
    let arr_max_pain_put_str_prc = [];
    let arr_combined_pain = [];
    let arr_combined_str_prc = [];

    let max_range = arr_str_prc_length;
    if (arr_str_prc_length >= ATM_call_index + 15) {
        max_range = ATM_call_index + 15;
    }


    let diff_in_str_prc = 0, product = 0, strk_prc = 0;
    for (let i = ATM_call_index; i < max_range; i++) {
        diff_in_str_prc = Math.abs(round((SpotPrice - arr_str_prc[i]) * 100, 2)); // Difference in Spot Price and Strike price
        product = round((diff_in_str_prc * (arr_call_oi[i] + arr_put_oi[i])) * 100, 2); // Product of difference in Strike Price and corresponding OI values
        arr_max_pain_put.push(product); //  push the product in array
        strk_prc = arr_str_prc[i];
        arr_max_pain_put_str_prc.push(strk_prc); // push the strike price in array
        arr_combined_pain.push(product); // push the product in combined array
        arr_combined_str_prc.push(strk_prc); // push the strike price in combined array
    }

    let max_pain_put = Math.max(...arr_max_pain_put);
    let min_pain_put = Math.min(...arr_max_pain_put);
    let max_pain_put_index = arr_max_pain_put.indexOf(max_pain_put);
    let min_pain_put_index = arr_max_pain_put.indexOf(min_pain_put);
    let max_pain_put_str_prc = arr_max_pain_put_str_prc[max_pain_put_index];
    let min_pain_put_str_prc = arr_max_pain_put_str_prc[min_pain_put_index];

    let min_range = 0;
    if (ATM_put_index > 15) {
        min_range = ATM_put_index - 14;
    }

    for (let i = min_range; i < ATM_put_index + 1; i++) {
        diff_in_str_prc = Math.abs(round((SpotPrice - arr_str_prc[i]) * 100, 2)); // Difference in Spot Price and Strike price
        product = round((diff_in_str_prc * (arr_call_oi[i] + arr_put_oi[i])) * 100, 2); // Product of difference in Strike Price and corresponding OI values
        arr_max_pain_call.push(product); //  push the product in array
        strk_prc = arr_str_prc[i];
        arr_max_pain_call_str_prc.push(strk_prc); // push the strike price in array
        arr_combined_pain.push(product); // push the product in combined array
        arr_combined_str_prc.push(strk_prc); // push the strike price in combined array
    }

    let max_pain_call = Math.max(...arr_max_pain_call);
    let min_pain_call = Math.min(...arr_max_pain_call);
    let max_pain_call_index = arr_max_pain_call.indexOf(max_pain_call);
    let min_pain_call_index = arr_max_pain_call.indexOf(min_pain_call);
    let max_pain_call_str_prc = arr_max_pain_call_str_prc[max_pain_call_index];
    let min_pain_call_str_prc = arr_max_pain_call_str_prc[min_pain_call_index];

    let combined_max_pain = Math.max(...arr_combined_pain);
    let combined_min_pain = Math.min(...arr_combined_pain);
    let arr_combined_max_pain_index = arr_combined_pain.indexOf(combined_max_pain);
    let arr_combined_min_pain_index = arr_combined_pain.indexOf(combined_min_pain);
    let combined_max_str_prc = arr_combined_str_prc[arr_combined_max_pain_index];
    let combined_min_str_prc = arr_combined_str_prc[arr_combined_min_pain_index];


    // this code was commented in python so i also writeen and commented it
    // arr_max_pain_call = [] ;
    // arr_max_pain_put = [];
    // arr_max_pain_call_str_prc = [];
    // arr_max_pain_put_str_prc = [];
    // arr_combined_pain = [];
    // arr_combined_str_prc = [];

    // if(arr_str_prc_length > ATM_call_index + 15){
    //     max_range = ATM_call_index + 15;
    // }
    // else{
    //     max_range = arr_str_prc_length;
    // }

    // for(let i = ATM_call_index; i < max_range; i++){
    // diff_in_str_prc = Math.abs(round((SpotPrice - arr_str_prc[i]) * 100, 2)); // Difference in Spot Price and Strike price 
    // product = round((diff_in_str_prc * (arr_call_oi[i] + arr_put_oi[i])) * 100, 2); // Product of difference in Strike Price and corresponding OI values
    //     arr_max_pain_put.push(product); //  push the product in array
    //     strk_prc = arr_str_prc[i];
    //     arr_max_pain_put_str_prc.push(strk_prc); // push the strike price in array
    //     arr_combined_pain.push(product); // push the product in combined array
    //     arr_combined_str_prc.push(strk_prc); // push the strike price in combined array
    //     max_pain_put_index = arr_max_pain_put.indexOf(Math.max(...arr_max_pain_put));
    //     min_pain_put_index = arr_max_pain_put.indexOf(Math.min(...arr_max_pain_put));
    //     max_pain_put_str_prc = arr_max_pain_put_str_prc[max_pain_put_index];
    //     min_pain_put_str_prc = arr_max_pain_put_str_prc[min_pain_put_index];
    // }

    // if(ATM_put_index > 15){
    //     min_range = ATM_put_index - 14;
    // }
    // else{
    //     min_range = 0;
    // }

    // for(let i = min_range; i < ATM_put_index + 1; i++){
    // diff_in_str_prc = Math.abs(round((SpotPrice - arr_str_prc[i]) * 100), 2); // Difference in Spot Price and Strike price 
    // product = round((diff_in_str_prc * (arr_call_oi[i] + arr_put_oi[i])) * 100, 2); // Product of difference in Strike Price and corresponding OI values
    //     arr_max_pain_call.push(product); //  push the product in array
    //     strk_prc = arr_str_prc[i];
    //     arr_max_pain_call_str_prc.push(strk_prc); // push the strike price in array
    //     arr_combined_pain.push(product); // push the product in combined array
    //     arr_combined_str_prc.push(strk_prc); // push the strike price in combined array
    //     max_pain_call_index = arr_max_pain_call.indexOf(Math.max(...arr_max_pain_call));
    //     min_pain_call_index = arr_max_pain_call.indexOf(Math.min(...arr_max_pain_call));
    //     max_pain_call_str_prc = arr_max_pain_call_str_prc[max_pain_call_index];
    //     min_pain_call_str_prc = arr_max_pain_call_str_prc[min_pain_call_index];
    // }

    // arr_combined_max_pain_index = arr_combined_pain.indexOf(Math.max(...arr_combined_pain));
    // arr_combined_min_pain_index = arr_combined_pain.indexOf(Math.min(...arr_combined_pain));
    // arr_combined_max_str_prc = arr_combined_str_prc[arr_combined_max_pain_index];
    // arr_combined_min_str_prc = arr_combined_str_prc[arr_combined_min_pain_index];

    console.log("max_pain_put" + max_pain_put);
    console.log("min_pain_put" + min_pain_put);
    console.log("max_pain_put_str_prc" + max_pain_put_str_prc);
    console.log("min_pain_put_str_prc" + min_pain_put_str_prc);
    console.log("max_pain_call" + max_pain_call);
    console.log("min_pain_call" + min_pain_call);
    console.log("max_pain_call_str_prc" + max_pain_call_str_prc);
    console.log("min_pain_call_str_prc" + min_pain_call_str_prc);
    console.log("combined_max_pain" + combined_max_pain);
    console.log("combined_min_pain" + combined_min_pain);
    console.log("combined_max_str_prc" + combined_max_str_prc);
    console.log("combined_min_str_prc" + combined_min_str_prc);

    min_pain_put = '{item[' + min_pain_put + ']}';
    max_pain_put_str_prc = '{item[' + max_pain_put_str_prc + ']}';
    min_pain_put_str_prc = '{item[' + min_pain_put_str_prc + ']}';
    max_pain_call = '{item[' + max_pain_call + ']}';
    min_pain_call = '{item[' + min_pain_call + ']}';
    max_pain_call_str_prc = '{item[' + max_pain_call_str_prc + ']}';
    min_pain_call_str_prc = '{item[' + min_pain_call_str_prc + ']}';
    combined_max_pain = '{item[' + combined_max_pain + ']}';
    combined_min_pain = '{item[' + combined_min_pain + ']}';
    combined_max_str_prc = '{item[' + combined_max_str_prc + ']}';
    combined_min_str_prc = '{item[' + combined_min_str_prc + ']}';

    // Logic to find 15 out of money summation for calls and store them in the master table
    let first_15_put_oi_sum = 0;
    let first_15_put_oi_change_sum = 0;
    let first_15_put_vol = 0;
    min_range = 0;
    if (ATM_put_index > 15) {
        min_range = ATM_put_index - 14;
    }
    for (let i = min_range; i <= ATM_put_index + 1; i++) {
        first_15_put_oi_sum = first_15_put_oi_sum + arr_put_oi[i];
        first_15_put_oi_change_sum = first_15_put_oi_change_sum + arr_put_chng_oi[i];
        first_15_put_vol = first_15_put_vol + arr_put_vol[i];
    }

    let first_15_call_oi_sum = 0;
    let first_15_call_oi_change_sum = 0;
    let first_15_call_vol = 0;
    if (arr_str_prc_length >= ATM_call_index + 15) {
        min_range = ATM_call_index + 15;
    }
    else {
        min_range = arr_str_prc_length;
    }

    for (let i = ATM_call_index; i < max_range; i++) {
        first_15_call_oi_sum = first_15_call_oi_sum + arr_call_oi[i];
        first_15_call_oi_change_sum = first_15_call_oi_change_sum + arr_call_chng_oi[i];
        first_15_call_vol = first_15_call_vol + arr_call_vol[i];
    }

    // Ratios
    let first_15_oi_sum_ratio = 0;
    let first_15_oi_change_sum_ratio = 0;
    let first_15_vol_ratio = 0;

    if (first_15_put_oi_sum !== 0) {
        first_15_oi_sum_ratio = round((first_15_call_oi_sum / first_15_put_oi_sum) * 100, 2);
    }
    if (first_15_put_oi_change_sum !== 0) {
        first_15_oi_change_sum_ratio = round((first_15_call_oi_change_sum / first_15_put_oi_change_sum) * 100, 2);
    }
    if (first_15_put_vol !== 0) {
        first_15_vol_ratio = round((first_15_call_vol / first_15_put_vol) * 100, 2);
    }

    // // 15 OI comparisons
    // if(first_15_call_oi_sum > first_15_put_oi_sum){
    //     console.log("Bear : 15 OI OTM Suggests. Sum of first 15 call is " + first_15_call_oi_sum + ". Sum of first 15 Put is " + first_15_put_oi_sum + ". Ratio of the call to put is " + first_15_oi_sum_ratio);
    // }
    // else{
    //     console.log("Bull : 15 OI OTM Suggests. Sum of first 15 call is " + first_15_call_oi_sum + ". Sum of first 15 Put is " + first_15_put_oi_sum + ". Ratio of the call to put is " + first_15_oi_sum_ratio);
    // }
    // // 15 OI Change comparisons
    // if(first_15_call_oi_change_sum > first_15_put_oi_change_sum){
    //     console.log("Bear : 15 Change in OI OTM Suggests. Sum of first 15 call is " + first_15_call_oi_change_sum + ". Sum of first 15 Put is " + first_15_put_oi_change_sum + ". Ratio of the call to put is " + first_15_oi_change_sum_ratio);
    // }  
    // else{
    //     console.log("Bull : 15 Change in OI OTM Suggests. Sum of first 15 call is " + first_15_call_oi_change_sum + ". Sum of first 15 Put is " + first_15_put_oi_change_sum + ". Ratio of the call to put is " + first_15_oi_change_sum_ratio);
    // }
    // // 15 Volume comparisons
    // if(first_15_call_vol > first_15_put_vol){
    //     console.log("Bear : 15 Vol OTM Suggests. Sum of first 15 call is " + first_15_call_vol + ". Sum of first 15 Put is " + first_15_put_vol + ". Ratio of the call to put is " + first_15_vol_ratio);
    // }
    // else{
    //     console.log("Bull : 15 Vol OTM Suggests. Sum of first 15 call is " + first_15_call_vol + ". Sum of first 15 Put is " + first_15_put_vol + ". Ratio of the call to put is " + first_15_vol_ratio);
    // }


    //  Logic to Find 10 out of Money Summation for Calls
    let first_10_put_oi_sum = 0;
    let first_10_put_oi_change_sum = 0;
    let first_10_put_vol = 0;
    min_range = 0;
    if (ATM_put_index > 10) {
        min_range = ATM_put_index - 9;
    }

    for (let i = min_range; i <= ATM_put_index + 1; i++) {
        first_10_put_oi_sum = first_10_put_oi_sum + arr_put_oi[i];
        first_10_put_oi_change_sum = first_10_put_oi_change_sum + arr_put_chng_oi[i];
        first_10_put_vol = first_10_put_vol + arr_put_vol[i];
    }

    // 10 Out of Money Summation for puts
    let first_10_call_oi_sum = 0;
    let first_10_call_oi_change_sum = 0;
    let first_10_call_vol = 0;
    if (arr_str_prc_length >= ATM_put_index + 10) {
        max_range = ATM_put_index + 10;
    }
    else {
        max_range = arr_str_prc_length;
    }

    for (let i = ATM_put_index; i < max_range; i++) {
        first_10_call_oi_sum = first_10_call_oi_sum + arr_call_oi[i];
        first_10_call_oi_change_sum = first_10_call_oi_change_sum + arr_call_chng_oi[i];
        first_10_call_vol = first_10_call_vol + arr_call_vol[i];
    }

    // Ratio's
    let first_10_oi_sum_ratio = 0;
    let first_10_oi_change_sum_ratio = 0;
    let first_10_vol_ratio = 0;

    if (first_10_put_oi_sum !== 0) {
        first_10_oi_sum_ratio = round((first_10_call_oi_sum / first_10_put_oi_sum) * 100, 2);
    }
    if (first_10_put_oi_change_sum !== 0) {
        first_10_oi_change_sum_ratio = round((first_10_call_oi_change_sum / first_10_put_oi_change_sum) * 100, 2);
    }
    if (first_10_put_vol !== 0) {
        first_10_vol_ratio = round((first_10_call_vol / first_10_put_vol) * 100, 2);
    }

    // // 10 OI comparisons
    // if (first_10_call_oi_sum > first_10_put_oi_sum) {
    //     console.log("Bear : 10 OI OTM Suggests. Sum of first 10 call is " + first_10_call_oi_sum + ". Sum of first 10 Put is " + first_10_put_oi_sum + ". Ratio of the call to put is " + first_10_oi_sum_ratio);
    // }
    // else {
    //     console.log("Bull : 10 OI OTM Suggests. Sum of first 10 call is " + first_10_call_oi_sum + ". Sum of first 10 Put is " + first_10_put_oi_sum + ". Ratio of the call to put is " + first_10_oi_sum_ratio);
    // }  

    // // 10 OI Change comparisons
    // if (first_10_call_oi_change_sum > first_10_put_oi_change_sum) {
    //     console.log("Bear : 10 Change in OI OTM Suggests. Sum of first 10 call is " + first_10_call_oi_change_sum + ". Sum of first 10 Put is " + first_10_put_oi_change_sum + ". Ratio of the call to put is " + first_10_oi_change_sum_ratio);
    // }   
    // else {
    //     console.log("Bull : 10 Change in OI OTM Suggests. Sum of first 10 call is " + first_10_call_oi_change_sum + ". Sum of first 10 Put is " + first_10_put_oi_change_sum + ". Ratio of the call to put is " + first_10_oi_change_sum_ratio);
    // }

    // //10 Volume comparisons
    // if (first_10_call_vol > first_10_put_vol) {
    //     console.log("Bear : 10 Vol OI OTM Suggests. Sum of first 10 call is " + first_10_call_vol + ". Sum of first 10 Put is " + first_10_put_vol + ". Ratio of the call to put is " + first_10_vol_ratio);
    // }
    // else {
    //     console.log("Bull : 10 Vol OI OTM Suggests. Sum of first 10 call is " + first_10_call_vol + ". Sum of first 10 Put is " + first_10_put_vol + ". Ratio of the call to put is " + first_10_vol_ratio);
    // }

    // Logic to Find 5 out of Money Summation for Puts 
    let first_5_put_oi_sum = 0;
    let first_5_put_oi_change_sum = 0;
    let first_5_put_vol = 0;
    if (ATM_put_index > 5) {
        min_range = ATM_put_index - 4;
    }
    else {
        min_range = 0;
    }

    for (let i = min_range; i <= ATM_put_index + 1; i++) {
        first_5_put_oi_sum = first_5_put_oi_sum + arr_put_oi[i];
        first_5_put_oi_change_sum = first_5_put_oi_change_sum + arr_put_chng_oi[i];
        first_5_put_vol = first_5_put_vol + arr_put_vol[i];
    }

    // 5 Out of Money Summation for calls
    let first_5_call_oi_sum = 0;
    let first_5_call_oi_change_sum = 0;
    let first_5_call_vol = 0;
    if (arr_str_prc_length >= ATM_call_index + 5) {
        max_range = ATM_call_index + 5;
    }
    else {
        max_range = arr_str_prc_length;
    }

    for (let i = ATM_call_index; i < max_range; i++) {
        first_5_call_oi_sum = first_15_call_oi_sum + arr_call_oi[i];
        first_5_call_oi_change_sum = first_15_call_oi_change_sum + arr_call_chng_oi[i];
        first_5_call_vol = first_15_call_vol + arr_call_vol[i];
    }

    // Ratio's
    let first_5_oi_sum_ratio = 0;
    let first_5_oi_change_sum_ratio = 0;
    let first_5_vol_ratio = 0;

    if (first_5_put_oi_sum !== 0) {
        first_5_oi_sum_ratio = round((first_5_call_oi_sum / first_5_put_oi_sum) * 100, 2);
    }

    if (first_5_put_oi_change_sum !== 0) {
        first_5_oi_change_sum_ratio = round((first_5_call_oi_change_sum / first_5_put_oi_change_sum) * 100, 2);
    }

    if (first_5_put_vol !== 0) {
        first_5_vol_ratio = round((first_5_call_vol / first_5_put_vol) * 100, 2);
    }

    // // 5 OI comparisons
    // if (first_5_call_oi_sum > first_5_put_oi_sum) {
    //     console.log("Bear : 5 OI OTM Suggests. Sum of first 5 call is " + first_5_call_oi_sum + ". Sum of first 5 Put is " + first_5_put_oi_sum + ". Ratio of the call to put is " + first_5_oi_sum_ratio);
    // }
    // else {
    //     console.log("Bull : 5 OI OTM Suggests. Sum of first 5 call is " + first_5_call_oi_sum + ". Sum of first 5 Put is " + first_5_put_oi_sum + ". Ratio of the call to put is " + first_5_oi_sum_ratio);
    // }

    // // 5 OI Change comparisons
    // if (first_5_call_oi_change_sum > first_5_put_oi_change_sum) {
    //     console.log("Bear : 5 Change in OI OTM Suggests. Sum of first 5 call is " + first_5_call_oi_change_sum + ". Sum of first 5 Put is " + first_5_put_oi_change_sum + ". Ratio of the call to put is " + first_5_oi_change_sum_ratio);   
    // }
    // else {
    //     console.log("Bull : 5 Change in OI OTM Suggests. Sum of first 5 call is " + first_5_call_oi_change_sum + ". Sum of first 5 Put is " + first_5_put_oi_change_sum + ". Ratio of the call to put is " + first_5_oi_change_sum_ratio);
    // }

    // // 5 Volume comparisons
    // if (first_5_call_vol > first_5_put_vol) {
    //     console.log("Bear : 5 Vol OTM Suggests. Sum of first 5 call is " + first_5_call_vol + ". Sum of first 5 Put is " + first_5_put_vol + ". Ratio of the call to put is " + first_5_vol_ratio);
    // }
    // else {
    //     console.log("Bull : 5 Vol OTM Suggests. Sum of first 5 call is " + first_5_call_vol + ". Sum of first 5 Put is " + first_5_put_vol + ". Ratio of the call to put is " + first_5_vol_ratio);
    // }

    // #Max Change in OI Ratio
    let max_put_chng_oi = Math.max(...arr_OTM_put_chng_in_OI);
    let index_max_put_chng_oi = arr_put_chng_oi.indexOf(max_put_chng_oi);
    let max_put_chng_oi_str_prc = arr_str_prc[index_max_put_chng_oi];

    let max_call_chng_oi = Math.max(...arr_OTM_call_chng_in_OI);
    let index_max_call_chng_oi = arr_call_chng_oi.indexOf(max_call_chng_oi);
    let max_call_chng_oi_str_prc = arr_str_prc[index_max_call_chng_oi];

    // if(max_call_chng_oi > max_put_chng_oi) {
    //     console.log("Bear : Intraday. Max Call change in OI " + max_call_chng_oi + ". Max Put chnage OI is " + max_put_chng_oi + " Strike price that can be sold is CE " + max_call_chng_oi_str_prc);
    // }
    // else {
    //     console.log("Bull : Intraday. Max Call change in OI " + max_call_chng_oi + ". Max Put chnage OI is " + max_put_chng_oi + " Strike price that can be sold is PE " + max_put_chng_oi_str_prc);
    // }

    // Max OI Logic
    let max_call_oi = Math.max(...arr_OTM_call_OI);
    let index_max_call_oi = arr_call_oi.indexOf(max_call_oi);
    let max_call_oi_str_prc = arr_str_prc[index_max_call_oi];

    let max_put_oi = Math.max(...arr_OTM_put_OI);
    let index_max_put_oi = arr_put_oi.indexOf(max_put_oi);
    let max_put_oi_str_prc = arr_str_prc[index_max_put_oi];

    if (max_call_oi > max_put_oi) {
        console.log("Bear : Positional Market. Max Call OI " + max_call_oi + ". Max Put OI is " + max_put_oi + " Strike price that can be sold is CE " + max_call_oi_str_prc);
    }
    else {
        console.log("Bull : Positional Market. Max Call OI " + max_call_oi + ". Max Put OI is " + max_put_oi + " Strike price that can be sold is PE " + max_put_oi_str_prc);
    }

    // Nitin Bhatia Excel Sheet in Real Time

    // MAKE THE CHANGE IN PROGRAM TO TAKE ONLY FIRST 10 VALUES
    let norm_dist_call_oi = 0;
    let norm_dist_put_oi = 0;
    let norm_dist_call_chng_oi = 0;
    let norm_dist_put_chng_oi = 0;
    let divisor_call = 0;
    let divisor_put = 0;


    if (ATM_call_iv !== 0 || ATM_put_iv !== 0) {
        divisor_call = (ATM_call_iv * Math.sqrt(days_for_expiry / 365)) / 100;
        divisor_put = (ATM_put_iv * Math.sqrt(days_for_expiry / 365)) / 100;
        dividend_call_oi = Math.log(max_call_oi_str_prc / SpotPrice);
        dividend_put_oi = Math.log(max_put_oi_str_prc / SpotPrice);
    }

    //Positional Logic Start
    if (divisor_call !== 0) {
        norm_dist_call_oi = round((stdNormal(dividend_put_oi / divisor_call)) * 100, 2);
    }
    if (divisor_put !== 0) {
        norm_dist_put_oi = round((1 - stdNormal(dividend_call_oi / divisor_put)) * 100, 2);
    }
    //Positional Logic End
    dividend_call_chng_oi = Math.log(max_call_chng_oi_str_prc / SpotPrice);
    dividend_put_chng_oi = Math.log(max_put_chng_oi_str_prc / SpotPrice);
    //Intraday Logic Start
    if (divisor_call !== 0) {
        norm_dist_call_chng_oi = round((stdNormal(dividend_put_chng_oi / divisor_call)) * 100, 2);
    }
    if (divisor_put !== 0) {
        norm_dist_put_chng_oi = round((1 - stdNormal(dividend_call_chng_oi / divisor_put)) * 100, 2)
    }
    //Intraday Logic End

    if (norm_dist_call_chng_oi > norm_dist_put_chng_oi) {
        console.log('Bear : Intraday Nitin Bhatia')
        item['bhatia_excel'] = 'Bear : Intraday Nitin Bhatia ' + norm_dist_call_chng_oi + ' > ' + norm_dist_put_chng_oi;
    }
    else {
        console.log('Bull : Intraday Nitin Bhatia')
        item['bhatia_excel'] = 'Bull : Intraday Nitin Bhatia ' + norm_dist_put_chng_oi + ' > ' + norm_dist_call_chng_oi;
    }
    //End Of Nitin Bhatia Excel Sheet

    // Total OI Logic
    if (CallTotalOI > PutTotalOI) {
        console.log('Bear : Total OI. Total Call OI ' + CallTotalOI + '. Total Put OI is ' + PutTotalOI);
    }
    else {
        console.log('Bull : Total OI. Total Call OI ' + CallTotalOI + '. Total Put OI is ' + PutTotalOI);
    }

    // Total Volume Logic
    if (PutTotalVolume > PutTotalVolume) {
        console.log('Bull : Total Volume. Total Volume is ' + PutTotalVolume + '. Total Put OI is ' + PutTotalVolume);
    }
    else {
        console.log('Bear : Total Volume. Total Volume is ' + PutTotalVolume + '. Total Put OI is ' + PutTotalVolume);
    }

    item['todays_range'] = 'Todays Range Is ' + max_put_chng_oi_str_prc + " and " + max_call_chng_oi_str_prc;
    item['positional_range'] = 'Positional Range Is ' + max_put_oi_str_prc + " and " + max_call_oi_str_prc;
    // item['todays_range'] = "Todays Range Is";
    // item['positional_range'] = "Positional Range Is";
    item['stock_name'] = StockName.trim();
    item['master_entry_id'] = a_id;
    item['negative_count'] = negative_count;
    item['atm_call'] = ATM_call;
    item['atm_put'] = ATM_put;
    item['atm_call_iv'] = ATM_call_iv;
    item['atm_put_iv'] = ATM_put_iv;
    item['six_call_iv_sum'] = six_call_iv_sum;
    item['six_put_iv_sum'] = six_put_iv_sum;
    item['six_call_ltp'] = six_call_ltp;
    item['six_put_ltp'] = six_put_ltp;
    item['call_neg_count'] = call_neg_count;
    item['put_neg_count'] = put_neg_count;
    item['first_15_put_oi_sum'] = first_15_put_oi_sum;
    item['first_15_put_oi_change_sum'] = first_15_put_oi_change_sum;
    item['first_15_put_vol'] = first_15_put_vol;
    item['first_15_call_oi_sum'] = first_15_call_oi_sum;
    item['first_15_call_oi_change_sum'] = first_15_call_oi_change_sum;
    item['first_15_call_vol'] = first_15_call_vol;
    item['first_15_oi_sum_ratio'] = first_15_oi_sum_ratio;
    item['first_15_oi_change_sum_ratio'] = first_15_oi_change_sum_ratio;
    item['first_15_vol_ratio'] = first_15_vol_ratio;
    item['first_10_put_oi_sum'] = first_10_put_oi_sum;
    item['first_10_put_oi_change_sum'] = first_10_put_oi_change_sum;
    item['first_10_put_vol'] = first_10_put_vol;
    item['first_10_call_oi_sum'] = first_10_call_oi_sum;
    item['first_10_call_oi_change_sum'] = first_10_call_oi_change_sum;
    item['first_10_call_vol'] = first_10_call_vol;
    item['first_10_oi_sum_ratio'] = first_10_oi_sum_ratio;
    item['first_10_oi_change_sum_ratio'] = first_10_oi_change_sum_ratio;
    item['first_10_vol_ratio'] = first_10_vol_ratio;
    item['first_5_put_oi_sum'] = first_5_put_oi_sum;
    item['first_5_put_oi_change_sum'] = first_5_put_oi_change_sum;
    item['first_5_put_vol'] = first_5_put_vol;
    item['first_5_call_oi_sum'] = first_5_call_oi_sum;
    item['first_5_call_oi_change_sum'] = first_5_call_oi_change_sum;
    item['first_5_call_vol'] = first_5_call_vol;
    item['first_5_oi_sum_ratio'] = first_5_oi_sum_ratio;
    item['first_5_oi_change_sum_ratio'] = first_5_oi_change_sum_ratio;
    item['first_5_vol_ratio'] = first_5_vol_ratio;
    item['max_call_chng_oi'] = max_call_chng_oi;
    item['max_put_chng_oi'] = max_put_chng_oi;
    item['max_call_oi'] = max_call_oi;
    item['max_put_oi'] = max_put_oi;
    item['max_pain_put'] = max_pain_put;
    item['min_pain_put'] = min_pain_put;
    item['max_pain_put_str_prc'] = max_pain_put_str_prc;
    item['min_pain_put_str_prc'] = min_pain_put_str_prc;
    item['max_pain_call'] = max_pain_call;
    item['min_pain_call'] = min_pain_call;
    item['max_pain_call_str_prc'] = max_pain_call_str_prc;
    item['min_pain_call_str_prc'] = min_pain_call_str_prc;
    item['combined_max_pain'] = combined_max_pain;
    item['combined_min_pain'] = combined_min_pain;
    item['combined_max_str_prc'] = combined_max_str_prc;
    item['combined_min_str_prc'] = combined_min_str_prc;
    yield item;
}


const pool = mysql.createPool({
    acquireTimeout: 10000,
    connectionLimit: 200,
    host: 'localhost',
    port: '3306',
    user: 'nscruxco_nscrux',
    password: 'NsCrux@88$$',
    database: 'nscruxco_sharemarket',
});

function parseAllStocks() {
    // stockNames = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'AARTIIND', 'ACC', 'ADANIENT', 'ADANIPORTS', 'APLLTD', 'ALKEM', 'AMARAJABAT', 'AMBUJACEM', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'AUBANK', 'AUROPHARMA', 'AXISBANK', 'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA', 'BERGEPAINT', 'BEL', 'BHARATFORG', 'BPCL', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BRITANNIA', 'CADILAHC', 'CANBK', 'CHOLAFIN', 'CIPLA', 'CUB', 'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'CUMMINSIND', 'DABUR', 'DEEPAKNTR', 'DIVISLAB', 'DLF', 'LALPATHLAB', 'DRREDDY', 'EICHERMOT', 'ESCORTS', 'EXIDEIND', 'FEDERALBNK', 'GAIL', 'GLENMARK', 'GMRINFRA', 'GODREJCP', 'GODREJPROP', 'GRANULES', 'GRASIM', 'GUJGASLTD', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HDFC', 'HEROMOTOCO', 'HINDALCO', 'HINDPETRO', 'HINDUNILVR', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IBULHSGFIN', 'IOC', 'IRCTC', 'IGL', 'INDUSTOWER', 'INDUSINDBK', 'NAUKRI', 'INFY', 'INDIGO', 'ITC', 'JINDALSTEL', 'JSWSTEEL', 'JUBLFOOD', 'KOTAKBANK', 'L&TFH', 'LTI', 'LTTS', 'LT', 'LICHSGFIN', 'LUPIN', 'M&MFIN', 'MGL', 'M&M', 'MANAPPURAM', 'MARICO', 'MARUTI', 'MFSL', 'MINDTREE', 'MOTHERSUMI', 'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NATIONALUM', 'NAVINFLUOR', 'NESTLEIND', 'NAM-INDIA', 'NMDC', 'NTPC', 'ONGC', 'PAGEIND', 'PETRONET', 'PFIZER', 'PIIND', 'PIDILITIND', 'PEL', 'PFC', 'POWERGRID', 'PNB', 'PVR', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SBILIFE', 'SHREECEM', 'SRTRANSFIN', 'SIEMENS', 'SRF', 'SBIN', 'SAIL', 'SUNPHARMA', 'SUNTV', 'TATACHEM', 'TCS', 'TATACONSUM', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TECHM', 'RAMCOCEM', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UBL', 'MCDOWELL-N', 'UPL', 'VEDL', 'IDEA', 'VOLTAS', 'WIPRO', 'ZEEL'];
    stockNames = ['NIFTY',]
    let count = 0;
    for (let i = 0; i < stockNames.length; i++) {
        getStockData(stockNames[i])
            .then(data => {

                const parseStock = parseStockData(data);
                for (let item of parseStock) {
                    try {
                        console.log(++count);
                        if (item['item_type'] === 'item1') {
                            pool.getConnection(function (err, connection) {
                                if (err) {
                                    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                                        console.error('Database connection was closed.')
                                    }
                                    if (err.code === 'ER_CON_COUNT_ERROR') {
                                        console.error('Database has too many connections.')
                                    }
                                    if (err.code === 'ECONNREFUSED') {
                                        console.error('Database connection was refused.')
                                    }
                                    connection.release();
                                    return;
                                } // not connected!

                                const query = `INSERT INTO nscruxco_sharemarket.tbl_master_entries2 (master_entry_id,stock_name,spot_price,start_date,start_time,expiry_date,created_at,updated_at,call_total_oi,call_total_volume,put_total_oi,put_total_volume) VALUES ('${item['master_entry_id']}','${item['stock_name']}','${item['spot_price']}','${item['start_date']}','${item['start_time']}','${item['expiry_date']}','${item['created_at']}','${item['updated_at']}','${item['call_total_oi']}','${item['call_total_volume']}','${item['put_total_oi']}','${item['put_total_volume']}')`;
                                connection.query(query, function (error, results, fields) {
                                    // Handle error after the release.
                                    if (error) {
                                        console.log('error in query while inserting in master table', error);
                                        // throw error
                                    };
                                });

                                const query2 = `INSERT INTO nscruxco_sharemarket.tbl_slaves_entries2 (slave_entry_id,master_entry_id_fk,calls_oi,calls_change_oi,calls_volume,calls_iv,calls_net_chng,strike_price,put_net_chng,put_iv,put_volume,put_chng_oi,put_oi,created_at,call_ltp,put_ltp) VALUES ('${item['slave_entry_id']}','${item['master_entry_id_fk']}','${item['calls_oi']}','${item['calls_change_oi']}','${item['calls_volume']}','${item['calls_iv']}','${item['calls_net_chng']}','${item['strike_price']}','${item['put_net_chng']}','${item['put_iv']}','${item['put_volume']}','${item['put_chng_oi']}','${item['put_oi']}','${item['created_at']}','${item['call_ltp']}','${item['put_ltp']}')`;
                                connection.query(query2, function (error, results, fields) {
                                    // When done with the connection, release it.
                                    if(error){
                                        console.log('error in query while inserting in slave table', error);
                                    }
                                    connection.release();
                                });
                            });
                        }
                        else if ([item['item_type'] === 'item2']) {
                            // update into table
                            // query = f'''UPDATE nscruxco_sharemarket.tbl_master_entries SET negative_count='{ item['negative_count'] } ',atm_call ='{ item['atm_call'] } ',atm_put ='{ item['atm_put'] } ',atm_call_iv ='{ item['atm_call_iv'] } ',atm_put_iv ='{ item['atm_put_iv'] } ',six_call_iv_sum ='{ item['six_call_iv_sum'] } ',six_put_iv_sum ='{ item['six_put_iv_sum'] } ',six_call_ltp ='{ item['six_call_ltp'] } ',six_put_ltp ='{ item['six_put_ltp'] } ',call_neg_count ='{ item['call_neg_count'] } ',put_neg_count ='{ item['put_neg_count'] } ',first_15_put_oi_sum ='{ item['first_15_put_oi_sum'] } ',first_15_put_oi_change_sum ='{ item['first_15_put_oi_change_sum'] } ',first_15_put_vol ='{ item['first_15_put_vol'] } ',first_15_call_oi_sum ='{ item['first_15_call_oi_sum'] } ',first_15_call_oi_change_sum ='{ item['first_15_call_oi_change_sum'] } ',first_15_call_vol ='{ item['first_15_call_vol'] } ',first_15_oi_sum_ratio ='{ item['first_15_oi_sum_ratio'] } ',first_15_oi_change_sum_ratio ='{ item['first_15_oi_change_sum_ratio'] } ',first_15_vol_ratio ='{ item['first_15_vol_ratio'] } ',first_10_put_oi_sum ='{ item['first_10_put_oi_sum'] } ',first_10_put_oi_change_sum ='{ item['first_10_put_oi_change_sum'] } ',first_10_put_vol ='{ item['first_10_put_vol'] } ',first_10_call_oi_sum ='{ item['first_10_call_oi_sum'] } ',first_10_call_oi_change_sum ='{ item['first_10_call_oi_change_sum'] } ',first_10_call_vol ='{ item['first_10_call_vol'] } ',first_10_oi_sum_ratio ='{ item['first_10_oi_sum_ratio'] } ',first_10_oi_change_sum_ratio ='{ item['first_10_oi_change_sum_ratio'] } ',first_10_vol_ratio ='{ item['first_10_vol_ratio'] } ',first_5_put_oi_sum ='{ item['first_5_put_oi_sum'] } ',first_5_put_oi_change_sum ='{ item['first_5_put_oi_change_sum'] } ',first_5_put_vol ='{ item['first_5_put_vol'] } ',first_5_call_oi_sum ='{ item['first_5_call_oi_sum'] } ',first_5_call_oi_change_sum ='{ item['first_5_call_oi_change_sum'] } ',first_5_call_vol ='{ item['first_5_call_vol'] } ',first_5_oi_sum_ratio ='{ item['first_5_oi_sum_ratio'] } ',first_5_oi_change_sum_ratio ='{ item['first_5_oi_change_sum_ratio'] } ',first_5_vol_ratio ='{ item['first_5_vol_ratio'] } ',max_call_oi ='{ item['max_call_oi'] } ',max_put_oi ='{ item['max_put_oi'] } ',bhatia_excel ='{ item['bhatia_excel'] } ',todays_range ='{ item['todays_range'] } ',positional_range ='{ item['positional_range'] } ' WHERE master_entry_id ="{item['master_entry_id']}"'''
                            const query3 = `UPDATE nscruxco_sharemarket.tbl_master_entries2 SET negative_count='${item['negative_count']}',atm_call ='${item['atm_call']}',atm_put ='${item['atm_put']}',atm_call_iv ='${item['atm_call_iv']}',atm_put_iv ='${item['atm_put_iv']}',six_call_iv_sum ='${item['six_call_iv_sum']}',six_put_iv_sum ='${item['six_put_iv_sum']}',six_call_ltp ='${item['six_call_ltp']}',six_put_ltp ='${item['six_put_ltp']}',call_neg_count ='${item['call_neg_count']}',put_neg_count ='${item['put_neg_count']}',first_15_put_oi_sum ='${item['first_15_put_oi_sum']}',first_15_put_oi_change_sum ='${item['first_15_put_oi_change_sum']}',first_15_put_vol ='${item['first_15_put_vol']}',first_15_call_oi_sum ='${item['first_15_call_oi_sum']}',first_15_call_oi_change_sum ='${item['first_15_call_oi_change_sum']}',first_15_call_vol ='${item['first_15_call_vol']}',first_15_oi_sum_ratio ='${item['first_15_oi_sum_ratio']}',first_15_oi_change_sum_ratio ='${item['first_15_oi_change_sum_ratio']}',first_15_vol_ratio ='${item['first_15_vol_ratio']}',first_10_put_oi_sum ='${item['first_10_put_oi_sum']}',first_10_put_oi_change_sum ='${item['first_10_put_oi_change_sum']}',first_10_put_vol ='${item['first_10_put_vol']}',first_10_call_oi_sum ='${item['first_10_call_oi_sum']}',first_10_call_oi_change_sum ='${item['first_10_call_oi_change_sum']}',first_10_call_vol ='${item['first_10_call_vol']}',first_10_oi_sum_ratio ='${item['first_10_oi_sum_ratio']}',first_10_oi_change_sum_ratio ='${item['first_10_oi_change_sum_ratio']}',first_10_vol_ratio ='${item['first_10_vol_ratio']}',first_5_put_oi_sum ='${item['first_5_put_oi_sum']}',first_5_put_oi_change_sum ='${item['first_5_put_oi_change_sum']}',first_5_put_vol ='${item['first_5_put_vol']}',first_5_call_oi_sum ='${item['first_5_call_oi_sum']}',first_5_call_oi_change_sum ='${item['first_5_call_oi_change_sum']}',first_5_call_vol ='${item['first_5_call_vol']}',first_5_oi_sum_ratio ='${item['first_5_oi_sum_ratio']}',first_5_oi_change_sum_ratio ='${item['first_5_oi_change_sum_ratio']}',first_5_vol_ratio ='${item['first_5_vol_ratio']}',max_call_oi ='${item['max_call_oi']}',max_put_oi ='${item['max_put_oi']}',bhatia_excel ='${item['bhatia_excel']}',todays_range ='${item['todays_range']}',positional_range ='${item['positional_range']}' WHERE master_entry_id ="${item['master_entry_id']}"`;
                            connection.query(query3, function (error, results, fields) {
                                // When done with the connection, release it.
                                // Handle error after the release.
                                if (error) {
                                    console.log('unable to get connection to update DB', error);
                                    // throw error
                                };
                                connection.release();
                            });
                        }
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
                // console.log(data);
            })
            .catch(err => {
                console.log(err);
            });
    }
}

getStockData('NIFTY');