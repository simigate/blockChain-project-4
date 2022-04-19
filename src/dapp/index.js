import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log('Operational :' + (error, result));
            display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }]);
        });

        contract.onLoadPopulate((result) => {
            DOM.elid('al-amount').value = result[0];
            DOM.elid('fl-insurance').placeholder = "Maximum is " + result[1] + " ETH";
            let select1 = DOM.elid('ftc-al-request');   //Requested airlines
            let select2 = DOM.elid('ftc-al-registd'); //Registered airlines
            let select3 = DOM.elid('ftc-fl-register');//Participating airline and non registered flights
            for (let i = 0; i < result[2].length; i++) {
                let reslt = result[2][i].split(',');
                //text has format :airlinAddress, airlineName
                //value has format: airlineAddress
                var el = DOM.option();
                el.textContent = result[2][i];
                el.value = reslt[0];
                select1.appendChild(el);
            }
            for (let i = 0; i < result[3].length; i++) {
                let reslt = result[3][i].split(',');
                //text has format :airlinAddress, airlineName
                //value has format: airlineAddress
                var el = DOM.option();
                el.textContent = result[3][i];
                el.value = reslt[0];
                select2.appendChild(el);
            }
            for (let i = 0; i < result[4].length; i++) {
                let reslt = result[4][i].split('|');
                //text has format :airlinAddress, airlineName - flightNumber
                //value has format: flight,timeStamp
                var el = DOM.option();
                el.textContent = reslt[0];
                el.value = reslt[1];
                select3.appendChild(el);
            }
            for (let i = 0; i < result[5].length; i++) {
                let reslt = result[5][i].split('|');
                let accountNameFlight = reslt[0];
                let flightTimeStamp = reslt[1];
                addRegisteredFlights(accountNameFlight, flightTimeStamp);
            }
            if (select3.value != "") {
                select3.dispatchEvent(new Event('change'));
            }
        });

        DOM.elid('change-operate').addEventListener('click', async () => {
            await contract.setOperatingStatus((error, result) => {
                console.log('ChangeOperational :' + (error, result));
            });
            await contract.isOperational((error, result) => {
                console.log('Operational :' + (error, result));
                display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }]);
            });

        })
        DOM.elid('add-contract').addEventListener('click', () => {
            if (DOM.elid('contract-add').value != "") {
                let contractAddress = DOM.elid('contract-add').value;
                contract.setAuthorizedContracts(contractAddress, (error, result) => {
                    console.log('AuthorizeContract :' + (error, result));
                });
            }
        })
        DOM.elid('register-al').addEventListener('click', () => {
            let name = DOM.elid('al-name').value;
            let airlineAcct = DOM.elid('al-address').value;
            if (name == "" || airlineAcct == "") {
                alert("Enter name and address");
            }
            else {
                // Write transaction
                contract.registerAirline(name, airlineAcct, (error, result) => {
                    if (!error) {
                        let select1 = DOM.elid('ftc-al-request');
                        //text has format :airlinAddress, airlineName
                        //value has format: airlineAddress
                        var el = DOM.option();
                        el.textContent = airlineAcct + ", " + name;
                        el.value = airlineAcct;
                        select1.appendChild(el);
                    }
                    console.log('Airline err:' + error, 'Airline res:' + result);
                });
            }

        })
        DOM.elid('approve-al').addEventListener('click', async () => {
            let select1 = DOM.elid('ftc-al-request');
            if (select1.value != "") {
                DOM.elid('al-status').value = "";
                select1.setAttribute("disabled", "disabled");
                let airlineAcct = DOM.elid('ftc-al-request').value;
                let noError = false;
                await contract.approveAirline(airlineAcct, (error, result) => {
                    if (!error) {
                        noError = true;
                        console.log('Approve res:' + result);
                    } else {
                        console.log('Approve err:' + error);
                    }
                    select1.removeAttribute("disabled");
                });
                ///For moving Airline to Registered List if Registered
                if (noError) {
                    contract.getAirlineRegistrationStatus(airlineAcct, (error, result) => {
                        let statusResult = "";
                        if (!error) {
                            if (result[0]) {

                                let select2 = DOM.elid('ftc-al-registd');
                                //text has format :airlinAddress, airlineName
                                //value has format: airlineAddress
                                var el = DOM.option();
                                el.textContent = select1.options[select1.selectedIndex].text;
                                el.value = select1.value;
                                select2.appendChild(el);
                                select1.options[select1.selectedIndex].remove();
                                DOM.elid('al-status').value = "";
                                statusResult = "Registration complete"
                            }
                            else {
                                statusResult = "Progressing with " + result[1] + " votes, Registered Airlines Count:" + result[2];
                            }
                        }
                        console.log('Status err:' + error, 'Status res:' + statusResult);
                    });
                }
            }
        })
        DOM.elid('status-al').addEventListener('click', () => {
            if (DOM.elid('ftc-al-request').value != "") {
                let airlineAcct = DOM.elid('ftc-al-request').value;
                contract.getAirlineRegistrationStatus(airlineAcct, (error, result) => {
                    if (!error) {
                        if (result[0]) {
                            DOM.elid('al-status').value = "Registration complete";
                        } else {
                            DOM.elid('al-status').value = "Progressing with " + result[1] + " votes, Registered Airlines Count:" + result[2];
                        }
                    }
                    console.log('Status err:' + error, 'Status votes:' + result[1]);
                });
            }
        })
        DOM.elid('send-al').addEventListener('click', async () => {
            let select2 = DOM.elid('ftc-al-registd');
            if (select2.value != "") {
                let noError = false;

                let select3 = DOM.elid('ftc-fl-register');
                let firstFlight = false;
                select2.setAttribute("disabled", "disabled");
                let airlineAcct = select2.value;
                let seedMoney = DOM.elid('al-amount').value;
                await contract.collectSeedMoney(airlineAcct, seedMoney, (error, result) => {
                    if (!error) {
                        if (select3.value == "") {
                            firstFlight = true;
                        }
                        contract.getFlights(airlineAcct, (result) => {
                            if (result.length > 0) {
                                for (let i = 0; i < result.length; i++) {
                                    let reslt = result[i].split('`');
                                    let date = reslt[4];
                                    date = date.substr(0, date.length - 2) + ' ' + date.substr(-2);
                                    let timeStamp = new Date(date).getTime();
                                    //text has format :airlinAddress, airlineName - flightNumber
                                    //value has format: flight,timeStamp
                                    var el = DOM.option();
                                    el.textContent = select2.options[select2.selectedIndex].text + " - " + reslt[0];
                                    el.value = result[i] + "," + timeStamp;
                                    select3.appendChild(el);
                                };
                            }
                        });
                        select2.options[select2.selectedIndex].remove();
                        noError = true;
                    }
                    console.log('Send err:' + error, 'Send res:' + result);
                    select2.removeAttribute("disabled");
                });

                //Loading flights of first participant to Add Flights list
                if (noError && firstFlight) {
                    select3.dispatchEvent(new Event('change'));
                }
            }
        })
        DOM.elid('register-fl').addEventListener('click', async () => {
            let select3 = DOM.elid('ftc-fl-register');
            if (select3.value != "") {
                select3.setAttribute("disabled", "disabled");
                let flightTimeStamp = select3.value.split(",");
                let airlineAcct = select3.options[select3.selectedIndex].text.split(",")[0];
                await contract.registerFlight(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], (error, result) => {
                    if (!error) {
                        addRegisteredFlights(select3.options[select3.selectedIndex].text, select3.value);
                        select3.options[select3.selectedIndex].remove();
                    }
                    console.log('RegFlights err:' + error, 'RegFlights res:' + result);
                    select3.removeAttribute("disabled");
                });
                //Loading details of first flight of this airplane
                if (select3.value != "") {
                    select3.dispatchEvent(new Event('change'));
                }
                if (select3.value == "") {// clear details as no flights available
                    DOM.elid('fl-data').value = "";
                }
            }
        })
        DOM.elid('book-fl').addEventListener('click', () => {
            let select4 = DOM.elid('ftc-fl-book');
            if (select4.value != "") {
                if (DOM.elid('pass-address').value == "" || DOM.elid('fl-insurance').value == "") {
                    alert("Enter Passenger address and Insurance paid");
                }
                else {
                    select4.setAttribute("disabled", "disabled");
                    let flightTimeStamp = select4.value.split(",");
                    let airlineAcct = select4.options[select4.selectedIndex].text.split(",")[0];
                    let passengerAcct = DOM.elid('pass-address').value;
                    let insurancePaid = DOM.elid('fl-insurance').value;
                    let price = DOM.elid('fl-price').value;
                    contract.bookFlight(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], passengerAcct, insurancePaid, price, (error, result) => {
                        console.log('BookFlights err:' + error, 'BookFlights res:' + result);
                        select4.removeAttribute("disabled");
                    });
                }
            }
        })
        DOM.elid('request-fl-status').addEventListener('click', () => {
            let select5 = DOM.elid('ftc-fl-status');
            if (select5.value != "") {
                select5.setAttribute("disabled", "disabled");
                let flightTimeStamp = select5.value.split(",");
                let airlineAcct = select5.options[select5.selectedIndex].text.split(",")[0];
                contract.requestOracleFlightStatus(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], (error, result) => {
                    console.log('RequestOracle err:' + error, 'RequestOracle res:' + result);
                    select5.removeAttribute("disabled");
                });
            }
        })

        DOM.elid('status-fl').addEventListener('click', () => {
            let select6 = DOM.elid('ftc-fl-insurance');
            if (select6.value != "") {
                let flightTimeStamp = select6.value.split(",");
                let airlineAcct = select6.options[select6.selectedIndex].text.split(",")[0];
                contract.checkFlightStatusResponse(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], (result) => {
                    switch (Number(result[0])) {
                        case 0:
                            DOM.elid('fl-status').value = "UNKNOWN";
                            break;
                        case 10:
                            DOM.elid('fl-status').value = "ON TIME";
                            break;
                        case 20:
                            DOM.elid('fl-status').value = "LATE AIRLINE";
                            break;
                        case 30:
                            DOM.elid('fl-status').value = "LATE WEATHER";
                            break;
                        case 40:
                            DOM.elid('fl-status').value = "LATE TECHNICAL";
                            break;
                        case 50:
                            DOM.elid('fl-status').value = "LATE OTHER";
                            break;
                    }
                    for (let i = 0; i < result[1].length; i++) {
                        let reslt = result[1][i].split(',');
                        //text has format :passengerAddress ,Amount: insuredAmount ETH
                        //value has format: passengerAddress,insuredAmount
                        var el = DOM.option();
                        el.textContent = reslt[0] + " ,Amount: " + reslt[1] + " ETH ";
                        el.value = result[1][i];
                        DOM.elid('ftc-fl-claims').appendChild(el);
                    }
                    console.log('Flight StatusCode :' + result[0]);
                });
            }
        })
        DOM.elid('claims-fl').addEventListener('click', async () => {
            let select6 = DOM.elid('ftc-fl-insurance');
            if (select6.value != "") {
                let select7 = DOM.elid('ftc-fl-claims');
                select6.setAttribute("disabled", "disabled");
                DOM.elid('fl-status').value = "";
                let flightTimeStamp = select6.value.split(",");
                let airlineAcct = select6.options[select6.selectedIndex].text.split(",")[0];
                for (let i = 0; i < select7.options.length; i++) {
                    let passengerAmt = select7.options[i].value.split(",");
                    contract.creditInsurees(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], passengerAmt[0], passengerAmt[1], (error, result) => {
                        console.log('Claims err:' + error, 'Claims res:' + result);
                        if (i == select7.options.length - 1) {
                            select6.removeAttribute("disabled");
                            select7.length = 0;
                        }
                    });
                }

            }
        })
        DOM.elid('check-credit').addEventListener('click', () => {
            let select6 = DOM.elid('ftc-fl-insurance');
            if (select6.value != "") {
                if (DOM.elid('pass-address-claim').value == "") {
                    alert("Enter Passenger address");
                }
                else {
                    let flightTimeStamp = select6.value.split(",");
                    let airlineAcct = select6.options[select6.selectedIndex].text.split(",")[0];
                    let passengerAcct = DOM.elid('pass-address-claim').value;
                    contract.checkCreditAmount(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], passengerAcct, (error, result) => {
                        if (!error) {
                            DOM.elid('fl-payout').value = result;
                        }
                        console.log('CheckCredit err:' + error, 'CheckCredit res:' + result);
                    });
                }
            }
        })
        DOM.elid('withdraw-fl').addEventListener('click', () => {
            if (DOM.elid('fl-payout').value != 0) {
                let select6 = DOM.elid('ftc-fl-insurance');
                select6.setAttribute("disabled", "disabled");
                let flightTimeStamp = select6.value.split(",");
                let airlineAcct = select6.options[select6.selectedIndex].text.split(",")[0];
                let passengerAcct = DOM.elid('pass-address-claim').value;
                let amount = DOM.elid('fl-payout').value;
                contract.withdraw(airlineAcct, flightTimeStamp[0], flightTimeStamp[1], passengerAcct, amount, (error, result) => {
                    console.log('Withdraw err:' + error, 'Withdraw res:' + result);
                    if (!error) {
                        DOM.elid('fl-payout').value = 0;
                    }
                    select6.removeAttribute("disabled");
                });
            }
        })
        DOM.elid('ftc-al-request').addEventListener('change', () => {
            DOM.elid('al-status').value = "";
        })
        DOM.elid('ftc-fl-register').addEventListener('change', () => {

            let result = DOM.elid('ftc-fl-register').value.split('`');
            DOM.elid('fl-data').value =
                'From : ' + result[1] +
                '                From date : ' + result[2] +
                '\nTo      : ' + result[3] +
                '               To date      : ' + result[4] +
                '\nPrice  : ' + result[5] + ' ETH';
        })
        DOM.elid('ftc-fl-book').addEventListener('change', () => {
            if (DOM.elid('ftc-fl-book').value != "") {
                let result = DOM.elid('ftc-fl-book').value.split('`');
                DOM.elid('fl-from').value = result[1];
                DOM.elid('fl-from-date').value = result[2];
                DOM.elid('fl-to').value = result[3];
                DOM.elid('fl-to-date').value = result[4];
                DOM.elid('fl-price').value = result[5].split(',')[0];
            }
        })
        DOM.elid('ftc-fl-insurance').addEventListener('change', () => {
            DOM.elid('fl-status').value = "";
            DOM.elid('ftc-fl-claims').length = 0;
            DOM.elid('fl-payout').value = 0;
        })
        DOM.elid('pass-address-claim').addEventListener('change', () => {
            DOM.elid('fl-payout').value = 0;
        })
    });
})();
function addRegisteredFlights(accountNameFlight, flightTimeStamp) {
    //text has format :airlinAddress, airlineName - flightNumber
    //value has format: flight,timeStamp
    let select5 = DOM.elid('ftc-fl-book');
    let select6 = DOM.elid('ftc-fl-status');
    let select7 = DOM.elid('ftc-fl-insurance');
    let firstFlight = false;
    if (select5.value == "") {
        firstFlight = true;
    }
    var el5 = DOM.option();
    el5.textContent = accountNameFlight;
    el5.value = flightTimeStamp;
    select5.appendChild(el5);

    var el6 = DOM.option();
    el6.textContent = accountNameFlight;
    el6.value = flightTimeStamp;
    select6.appendChild(el6);

    var el7 = DOM.option();
    el7.textContent = accountNameFlight;
    el7.value = flightTimeStamp;
    select7.appendChild(el7);
    if (firstFlight) {
        select5.dispatchEvent(new Event('change'));
    }
}
function clearFlightDetails() {
    DOM.elid('fl-from').value = "";
    DOM.elid('fl-from-date').value = "";
    DOM.elid('fl-to').value = "";
    DOM.elid('fl-to-date').value = "";
    DOM.elid('fl-price').value = "";
}

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({ className: 'row' }));
        row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label));
        row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}
