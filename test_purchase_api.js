// Test script to debug the purchase API
const axios = require('axios');

const testPurchaseAPI = async () => {
    try {
        const testPayload = {
            fyearid: 1,
            trdate: '2026-01-28',
            suppinvno: 'TEST-001',
            suppinvdt: '2026-01-28',
            partyid: 82,
            remark: 'Test purchase',
            items: [{
                itemcode: 1,
                qty: 1,
                rate: 100,
                taxableValue: 100,
                cgstAmt: 9,
                sgstAmt: 9,
                igstAmt: 0,
                lineTotal: 118,
                cgstPer: 9,
                sgstPer: 9,
                igstPer: 0
            }],
            overheads: {},
            tptcharge: 0,
            labcharge: 0,
            misccharge: 0,
            packcharge: 0,
            costsheetprepared: false,
            grnposted: true,
            costconfirmed: false
        };

        console.log('Testing purchase API with payload:', JSON.stringify(testPayload, null, 2));

        const response = await axios.post('http://localhost:5000/api/purchase/complete', testPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your-token-here' // Replace with actual token
            }
        });

        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
};

testPurchaseAPI();