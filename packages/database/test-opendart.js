// Test OpenDart API Key from SystemSettings
require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

async function testOpenDartApiKey() {
    try {
        // 1. Get API key from SystemSettings
        console.log('1. Reading OPENDART_API_KEY from SystemSettings...');
        const setting = await prisma.systemSettings.findUnique({
            where: { key: 'OPENDART_API_KEY' },
        });

        if (!setting) {
            console.log('❌ OPENDART_API_KEY not found in SystemSettings');
            return;
        }

        const apiKey = setting.value;
        console.log(`✅ Found API key: ${apiKey?.substring(0, 10)}...${apiKey?.substring(apiKey.length - 5)}`);
        console.log(`   Length: ${apiKey?.length} characters`);

        if (!apiKey || apiKey.trim() === '') {
            console.log('❌ API key is empty!');
            return;
        }

        // 2. Test API with a simple company.json call
        console.log('\n2. Testing OpenDart API...');
        const corpCode = '00126380'; // Samsung Electronics
        const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${corpCode}`;
        
        console.log(`   URL: ${url.substring(0, 60)}...`);

        const response = await new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            };

            https.get(options, (res) => {
                console.log(`   HTTP Status: ${res.statusCode}`);
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log(`   Raw Response (first 200 chars): ${data.substring(0, 200)}`);
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.log('   ❌ Not valid JSON');
                        resolve({ status: 'PARSE_ERROR', message: data.substring(0, 200) });
                    }
                });
            }).on('error', reject);
        });

        console.log('\n3. API Response:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Message: ${response.message}`);

        if (response.status === '000') {
            console.log('\n✅ SUCCESS! API key is working correctly.');
            console.log(`   Company: ${response.corp_name}`);
            console.log(`   Stock Code: ${response.stock_code}`);
            console.log(`   CEO: ${response.ceo_nm}`);
        } else if (response.status === '010') {
            console.log('\n❌ ERROR: Invalid API key (status 010)');
            console.log('   The API key is not registered with OpenDart.');
        } else {
            console.log(`\n⚠️  API returned status: ${response.status}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testOpenDartApiKey();
