import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3Provider = null;
        this.initWeb3(callback);
        //this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(this.web3Provider);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.getMetaskAccountID();
        //this.initialize(callback);
        //this.owner = null;
        this.metamaskAccountID = null;
        this.flights = [];
        this.initFlightList();
        this.operationalStatus = false;
        this.STATUS_CODE_LATE_AIRLINE = 0;
        this.SEED_AIRLINE_MONEY = 0;
        this.INSURANCE_MAX = 0;
    }
    async initWeb3(callback) {
        /// Find or Inject Web3 Provider
        /// Modern dapp browsers...
        if (window.ethereum) {
            this.web3Provider = window.ethereum;
            try {
                // Request account access
                await window.ethereum.enable();
            } catch (error) {
                // User denied account access...
                console.error("User denied account access")
            }
        }
        // Legacy dapp browsers...
        else if (window.web3) {
            this.web3Provider = window.web3.currentProvider;
        }
        // If no injected web3 instance is detected, fall back to Ganache
        else {
            this.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
        }
        callback();
    }

    getMetaskAccountID() {
        return new Promise(async (resolve, reject) => {
            // Retrieving accounts
            await this.web3.eth.getAccounts(function (err, res) {
                if (err) {
                    console.log('Error:', err);
                    return;
                }
                console.log('getMetaskID:', res[0]);
                this.metamaskAccountID = res[0];
                resolve(res[0]);
            });
        });
    }
    /* 
        initialize(callback) {
            this.web3.eth.getAccounts((error, accts) => {
                this.owner = accts[0];
                           let counter = 1;
                           while (this.airlines.length < 5) {
                                this.airlines.push(accts[counter++]);
                            }
                             while (this.passengers.length < 5) {
                                this.passengers.push(accts[counter++]);
                            }
                callback();
            });
        } */
    initFlightList() {
        this.flight = ["F1A1`PlaceF1`5/5/2022 11:11AM`PlaceA1`6/6/2022 12:12PM`5",
            "F2A1`PlaceF2`5/6/2022 11:11AM`PlaceA1`6/6/2022 12:12PM`6",
            "F3A1`PlaceF3`5/7/2022 11:11AM`PlaceA1`6/6/2022 12:12PM`7",
            "F1A2`PlaceF1`5/8/2022 11:11AM`PlaceA2`6/6/2022 12:12PM`8",
            "F2A2`PlaceF2`5/9/2022 11:11AM`PlaceA2`6/6/2022 12:12PM`9",
            "F1A3`PlaceF1`5/5/2022 11:11AM`PlaceA3`6/8/2022 12:12PM`8",
            "F1A4`PlaceF1`5/5/2022 11:11AM`PlaceA4`6/7/2022 12:12PM`7",
            "F1A5`PlaceF1`5/5/2022 11:11AM`PlaceA5`6/6/2022 12:12PM`6",
            "F2A5`PlaceF2`5/5/2022 11:11AM`PlaceA5`6/5/2022 12:12PM`5"];
    }


    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.metamaskAccountID }, (error, result) => {
                if (!error) {
                    self.operationalStatus = result;
                }
                callback(error, result);
            });
    }
    async setOperatingStatus(callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        let newStatus = !self.operationalStatus;
        await self.flightSuretyApp.methods
            .setOperatingStatus(newStatus)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    async setAuthorizedContracts(contractAddress, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        self.flightSuretyData.methods
            .setAuthorizedContracts(contractAddress)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    async registerAirline(name, account, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        let _name = self.web3.utils.stringToHex(name);
        self.flightSuretyData.methods
            .registerAirline(_name, account)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    async getAirlineRegistrationStatus(account, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        self.flightSuretyData.methods
            .getAirlineRegistrationStatus(account)
            .call({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            })
    }
    async approveAirline(account, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        await self.flightSuretyApp.methods
            .approveAirline(account)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }

    async collectSeedMoney(account, seedMoney, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        let seedtoWei = self.web3.utils.toWei(seedMoney, "ether");
        await self.flightSuretyData.methods
            .collectSeedMoney(account)
            .send({ from: self.metamaskAccountID, value: seedtoWei }, (error, result) => {
                callback(error, result);
            });
    }
    async registerFlight(account, flight, timeStamp, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        await self.flightSuretyApp.methods
            .registerFlight(account, flight, timeStamp, 0)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    async bookFlight(account, flight, timeStamp, passengerAcct, insurancePaid, price, callback) {
        let self = this;
        insurancePaid = self.web3.utils.toWei(insurancePaid, "ether");
        price = self.web3.utils.toWei(price, "ether");
        let amountSendinWei = Number(insurancePaid) + Number(price);
        self.metamaskAccountID = await self.getMetaskAccountID();
        console.log(account + " " + flight + " " + timeStamp + " " + passengerAcct + " " + insurancePaid + " " + price + " " + self.metamaskAccountID + " " + amountSendinWei);
        await self.flightSuretyData.methods
            .bookFlight(account, flight, timeStamp, passengerAcct, insurancePaid, price)
            .send({ from: self.metamaskAccountID, value: amountSendinWei, gas: 9999999 }, (error, result) => {
                callback(error, result);
            });

    }

    async requestOracleFlightStatus(account, flight, timeStamp, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        self.flightSuretyApp.methods
            .requestOracleFlightStatus(account, flight, timeStamp)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    async checkFlightStatusResponse(account, flight, timeStamp, callback) {
        let self = this;
        let passengersInsured = [];
        let result = [];
        let statusCode = 0;
        self.metamaskAccountID = await self.getMetaskAccountID();
        statusCode = await self.flightSuretyApp.methods
            .checkFlightStatusResponse(account, flight, timeStamp)
            .call({ from: self.metamaskAccountID });
        if (statusCode == self.STATUS_CODE_LATE_AIRLINE) {
            let passengers = [];
            passengers = await self.flightSuretyData.methods
                .getFlightInsurees(account, flight, timeStamp)
                .call({ from: self.metamaskAccountID });
            for (let i = 0; i < passengers.length; i++) {
                let insuredAmt = await self.flightSuretyData.methods
                    .getInsuredAmount(account, flight, timeStamp, passengers[i])
                    .call({ from: self.metamaskAccountID })
                insuredAmt = self.web3.utils.fromWei(insuredAmt, "ether");
                if (insuredAmt != 0) {
                    passengersInsured.push(passengers[i] + "," + insuredAmt);
                    console.log(passengers[i] + "," + insuredAmt);
                }
            }
        }
        result = [statusCode, passengersInsured];
        callback(result);
    }
    async creditInsurees(account, flight, timeStamp, passengerAcct, amount, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        let amountSendinWei = self.web3.utils.toWei(amount, "ether");
        await self.flightSuretyData.methods
            .creditInsurees(account, flight, timeStamp, passengerAcct)
            .send({ from: self.metamaskAccountID, value: amountSendinWei }, (error, result) => {
                callback(error, result);
            });
    }
    async checkCreditAmount(account, flight, timeStamp, passengerAcct, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        await self.flightSuretyData.methods
            .checkCreditAmount(account, flight, timeStamp, passengerAcct)
            .call({ from: self.metamaskAccountID }, (error, result) => {
                if (!error) {
                    result = self.web3.utils.fromWei(result, "ether");
                }
                callback(error, result);
            });
    }
    async withdraw(account, flight, timeStamp, passengerAcct, amount, callback) {
        let self = this;
        self.metamaskAccountID = await self.getMetaskAccountID();
        let amountSendinWei = self.web3.utils.toWei(amount, "ether");
        await self.flightSuretyData.methods
            .withdraw(account, flight, timeStamp, passengerAcct, amountSendinWei)
            .send({ from: self.metamaskAccountID }, (error, result) => {
                callback(error, result);
            });
    }
    getFlights(account, callback) {
        let self = this;
        let result = [];
        switch (account) {
            case "0xf17f52151EbEF6C7334FAD080c5704D77216b732":
                result = [self.flight[0], self.flight[1], self.flight[2]];
                callback(result);
                break;
            case "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef":
                result = [self.flight[3], self.flight[4]];
                callback(result);
                break;
            case "0x821aEa9a577a9b44299B9c15c88cf3087F3b5544":
                result = [self.flight[5]];
                callback(result);
                break;
            case "0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2":
                result = [self.flight[6]];
                callback(result);
                break;
            case "0x2932b7A2355D6fecc4b5c0B6BD44cC31df247a2e":
                result = [self.flight[7], self.flight[8]];
                callback(result);
                break;
            default:
                callback(result);
        }
    }
    async onLoadPopulate(callback) {
        let self = this;
        let airlines = [];
        let requested = [];
        let registered = [];
        let participate = [];
        let flightNotRegistered = [];
        let flightRegistered = [];
        let result = [];
        self.metamaskAccountID = await self.getMetaskAccountID();
        self.SEED_AIRLINE_MONEY = await self.flightSuretyApp.methods.SEED_AIRLINE_MONEY().call();
        self.SEED_AIRLINE_MONEY = self.web3.utils.fromWei(self.SEED_AIRLINE_MONEY, "ether");
        self.INSURANCE_MAX = await self.flightSuretyApp.methods.INSURANCE_MAX().call();
        self.INSURANCE_MAX = self.web3.utils.fromWei(self.INSURANCE_MAX, "ether");
        self.STATUS_CODE_LATE_AIRLINE = await self.flightSuretyApp.methods.STATUS_CODE_LATE_AIRLINE().call();
        airlines = await self.flightSuretyData.methods
            .getAirlinesOnLoad()
            .call({ from: self.metamaskAccountID });
        for (let i = 0; i < airlines.length; i++) {
            let status = await self.flightSuretyData.methods
                .getAirlinesStatusOnLoad(airlines[i])
                .call({ from: self.metamaskAccountID })
            let _name = self.web3.utils.hexToString(status[2]);
            if (status[1]) {
                participate.push(airlines[i] + ", " + _name);
            } else if (status[0]) {
                registered.push(airlines[i] + ", " + _name);
            } else if (!status[0]) {
                requested.push(airlines[i] + ", " + _name);
            }
        }
        for (let i = 0; i < participate.length; i++) {
            let account = participate[i].split(',')[0];
            let reslt = [];
            let date = "";
            let timeStamp = "";
            switch (account) {
                case "0xf17f52151EbEF6C7334FAD080c5704D77216b732":
                    for (let j = 0; j < 3; j++) {
                        reslt = self.flight[j].split("`");
                        date = reslt[4];
                        date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                        timeStamp = new Date(date).getTime();
                        await self.flightSuretyApp.methods
                            .getFlightRegistrationOnLoad(account, self.flight[j], timeStamp)
                            .call({ from: self.metamaskAccountID }, (error, result) => {
                                if (result) {
                                    flightRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                                else {
                                    flightNotRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                            });
                    }
                    break;
                case "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef":
                    for (let j = 3; j < 5; i++) {
                        reslt = self.flight[j].split("`");
                        date = reslt[4];
                        date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                        timeStamp = new Date(date).getTime();
                        await self.flightSuretyApp.methods
                            .getRegistrationOnLoad(account, self.flight[j], timeStamp)
                            .call({ from: self.metamaskAccountID }, (error, result) => {
                                if (result) {
                                    flightRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                                else {
                                    flightNotRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                            });
                    }
                    break;
                case "0x821aEa9a577a9b44299B9c15c88cf3087F3b5544":
                    reslt = self.flight[5].split("`");
                    date = reslt[4];
                    date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                    timeStamp = new Date(date).getTime();
                    await self.flightSuretyApp.methods
                        .getRegistrationOnLoad(account, self.flight[5], timeStamp)
                        .call({ from: self.metamaskAccountID }, (error, result) => {
                            if (result) {
                                flightRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[5] + "," + timeStamp);
                            }
                            else {
                                flightNotRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[5] + "," + timeStamp);
                            }
                        });
                    break;
                case "0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2":
                    reslt = self.flight[6].split("`");
                    date = reslt[4];
                    date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                    timeStamp = new Date(date).getTime();
                    await self.flightSuretyApp.methods
                        .getRegistrationOnLoad(account, self.flight[6], timeStamp)
                        .call({ from: self.metamaskAccountID }, (error, result) => {
                            if (result) {
                                flightRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[6] + "," + timeStamp);
                            }
                            else {
                                flightNotRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[6] + "," + timeStamp);
                            }
                        });
                    break;
                case "0x2932b7A2355D6fecc4b5c0B6BD44cC31df247a2e":
                    for (let j = 7; j < 9; i++) {
                        reslt = self.flight[j].split("`");
                        date = reslt[4];
                        date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                        timeStamp = new Date(date).getTime();
                        await self.flightSuretyApp.methods
                            .getFlightRegistrationOnLoad(account, self.flight[j], timeStamp)
                            .call({ from: self.metamaskAccountID }, (error, result) => {
                                if (result) {
                                    flightRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                                else {
                                    flightNotRegistered.push(participate[i] + " - " + reslt[0] + "|" + self.flight[j] + "," + timeStamp);
                                }
                            });
                    }
                    break;
            }

        }
        result = [self.SEED_AIRLINE_MONEY, self.INSURANCE_MAX, requested, registered, flightNotRegistered, flightRegistered];
        callback(result);
    }
}