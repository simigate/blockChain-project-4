import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import fs from 'fs';
let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.appAddress);
let ORACLESCOUNT = 20;
let oraclesAccounts = [];
let oracleAcctIndexes = [];
let owner = null;
let statusCode = null;
let REGISTRATION_FEE = 0;
let MIN_RESPONSES = 0;
let STATUS_CODE_UNKNOWN = 0;
let STATUS_CODE_ON_TIME = 0;
let STATUS_CODE_LATE_AIRLINE = 0;
let STATUS_CODE_LATE_WEATHER = 0;
let STATUS_CODE_LATE_TECHNICAL = 0;
let STATUS_CODE_LATE_OTHER = 0;
let getOracleAccounts = () => {
  return new Promise((resolve, reject) => {
    web3.eth.getAccounts()
      .then(accts => {
        owner = accts[0];
        console.log(owner);
        let counter = 20;
        while (counter < 20 + ORACLESCOUNT) {
          oraclesAccounts.push(accts[counter++]);
        }
        resolve();
      })
      .catch(err => {
        console.log('Error getAccounts:', err);
      });
  });
}
let loadInit = () => {
  return new Promise((resolve, reject) => {
    flightSuretyApp.methods.loadInit()
      .call({ from: owner })
      .then(result => {
        REGISTRATION_FEE = result[0];
        MIN_RESPONSES = result[1];
        STATUS_CODE_UNKNOWN = result[2];
        STATUS_CODE_ON_TIME = result[3];
        STATUS_CODE_LATE_AIRLINE = result[4];
        STATUS_CODE_LATE_WEATHER = result[5];
        STATUS_CODE_LATE_TECHNICAL = result[6];
        STATUS_CODE_LATE_OTHER = result[7];

        var array = fs.readFileSync('./src/server/oracleAcctIndexes.txt').toString().split("\n");
        for (let i = 0; i < array.length - 1; i++) {
          oracleAcctIndexes.push(array[i]);
        }
        console.log("Length:" + oracleAcctIndexes.length);
        resolve();
      })
      .catch(err => {
        console.log('Error getInit:', err);
      });
  });
}

let registerOracleAccounts = () => {
  console.log('register:' + REGISTRATION_FEE + "," + oraclesAccounts.length);
  return new Promise((resolve, reject) => {
    for (let i = 0; i < oraclesAccounts.length; i++) {
      flightSuretyApp.methods.registerOracle()
        .send({ from: oraclesAccounts[i], value: REGISTRATION_FEE, gas: 3000000, gasPrice: 3000000 })
        .then(() => {
          flightSuretyApp.methods.getMyIndexes()
            .call({ from: oraclesAccounts[i] })
            .then(index => {
              fs.appendFileSync('./src/server/oracleAcctIndexes.txt', oraclesAccounts[i] + "," + index + '\n');
              oracleAcctIndexes.push(oraclesAccounts[i] + "," + index);

            })
            .catch(err => {
              console.log('getMyIndex' + i + err);
            });
        })
        .catch(err => {
          console.log('registerOracle' + i + err);
        });
    }
    // resolve();
  });
}
let getStatusCode = () => {
  return new Promise((resolve, reject) => {
    let status = Math.floor(Math.random() * 6);
    switch (status) {
      case 0:
        statusCode = STATUS_CODE_UNKNOWN;
        break;
      case 1:
        statusCode = STATUS_CODE_ON_TIME;
        break;
      case 2:
        statusCode = STATUS_CODE_LATE_AIRLINE;
        break;
      case 3:
        statusCode = STATUS_CODE_LATE_WEATHER;
        break;
      case 4:
        statusCode = STATUS_CODE_LATE_TECHNICAL;
        break;
      case 5:
        statusCode = STATUS_CODE_LATE_OTHER;
        break;
    }
    //statusCode = STATUS_CODE_LATE_AIRLINE;
    resolve();
  });
}
let oracleSubmit = (index, airline, flight, timestamp) => {
  return new Promise((resolve, reject) => {

    for (let i = 0; i < oracleAcctIndexes.length; i++) {
      console.log(oracleAcctIndexes[i]);
      let acctIndexes = oracleAcctIndexes[i].split(",");
      console.log(index + ",oracle:" + acctIndexes[0] + "statusCode:" + statusCode);
      if (acctIndexes[1] == index || acctIndexes[2] == index || acctIndexes[3] == index) {
        console.log(acctIndexes[1] + "," + acctIndexes[2] + "," + acctIndexes[3] + "," + "oracle:" + acctIndexes[0] + "statusCode:" + statusCode);
        setTimeout(() => {
          flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode)
            .send({ from: acctIndexes[0] })
            .then(res => { console.log('submitOracle :res' + i + res); })
            .catch(err => {
              console.log('submitOracle:err' + i + err);
            });
        }, i * 1000)
      }
    }
  });
}
flightSuretyApp.events.OracleRequest({
  fromBlock: 'latest'
}, function (error, event) {
  if (error) {
    console.log("OracleRequest:" + error);
  }
  else {
    console.log(event);
    getStatusCode()
      .then(() => {
        oracleSubmit(event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp);

      });

  }
});


const app = express();
app.get('/', (req, res) => {

  res.send({

    message: 'An API for use with your Dapp!',

  })
})


getOracleAccounts()
  .then(() => {
    loadInit()
      .then(() => {
        registerOracleAccounts();

      });
  });

export default app;
