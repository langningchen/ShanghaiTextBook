import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const CHINESEALL_TOKEN = JSON.parse(readFileSync(new URL('../token.json', import.meta.url), 'utf8'));

const CHINESEALL_SIGN_EXP = Date.now();
const result = {};
for (const item of data['data']) {
    const uuid = item['uuid'];
    const url = `/teaching/api/v1/textbook/key/${uuid}`;
    const md5Hash = createHash('md5');
    md5Hash.update(`CHINESEALL_SIGN_EXP=${CHINESEALL_SIGN_EXP}&CHINESEALL_TOKEN=${CHINESEALL_TOKEN}&CONTEXT=${url}&SECURITY_KEY=e3YCNDTCzmB6fvRC`);
    const CHINESEALL_SIGN = md5Hash.digest('hex');
    const headers = {
        "Content-Type": "application/json;charset=UTF-8",
        CHINESEALL_TOKEN,
        APP_ID: "Cm898ZMkxo7OlBlO",
        CHINESEALL_SIGN,
        CHINESEALL_SIGN_EXP
    };
    const response = await fetch(`https://appsupport.sh-genius.cn${url}`, {
        headers
    }).then(res => res.json());
    result[uuid] = response.data;
    console.log(uuid, response.data)
}
console.log(JSON.stringify(result));
