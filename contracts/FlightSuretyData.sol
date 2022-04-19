// SPDX-License-Identifier: MIT
pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /*****    DATA VARIABLES     *****/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false
    uint256 private INSURANCE_MAX; //Max insurance the passenger can take
    uint8 private INSURANCE_MULTIPLIER; //Insurance Amount is 1.5X (so *3 and /2)
    uint8 private INSURANCE_DIVIDER;

    struct Airline {
        bytes32 name;
        bool registered;
        bool participate;
        uint256 funded;
    }
    struct Passenger {
        uint256 insurancePaid;
        uint256 insuredAmount;
        uint256 creditPaid;
    }
    Passenger[] flightPassenger;
    mapping(bytes32 => address[]) flKeyToPassAddress;
    mapping(address => Airline) airlines;
    mapping(bytes32 => Passenger) passengers;
    uint256 regAirlineCount = 0;
    mapping(string => address[]) addedToAirlineAddress;
    mapping(address => address[]) addressToApprovers;
    mapping(address => uint256) authorizedContracts;

    /*********                  EVENT DEFINITIONS                    ********/

    event AirlineAdded(address _airlineAcct);
    event AirlineRegistered(address _airlineAcct);
    event AirlineFunded(address _airlineAcct);

    //Constructor
    // The deploying account becomes contractOwner
    constructor(address _airlineAcct) public {
        contractOwner = msg.sender;
        _registerAirline("A1", _airlineAcct);
    }

    /******                FUNCTION MODIFIERS             *********/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    // Modifier that requires the "operational" boolean variable to be "true"
    //      This is used on all state changing functions to pause the contract in
    //      the event there is an issue that needs to be fixed
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }
    // Modifier that requires the "ContractOwner" account to be the function caller
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    //Modifier that requires address and msg.sender to be same
    modifier requireIsRequestOwner(address _account, address sender) {
        require(_account == sender, "Address and msg.sender should be same");
        _;
    }

    //Modifier that requires airline address not added already
    modifier requireAirlineNotAdded(address _airlineAcct) {
        require(
            airlines[_airlineAcct].name == "",
            "Airline with this account already added"
        );
        _;
    }

    //Modifier that requires airline address already added
    modifier requireAirlineIsAdded(address _airlineAcct) {
        require(
            airlines[_airlineAcct].registered == false,
            "The airline is already registered"
        );
        _;
    }

    //Modifier that requires msg.sender is registered
    modifier requireApproverRegistered(address approver) {
        require(
            airlines[approver].registered == true,
            "Only Registered Airlines can Approve"
        );
        _;
    }

    //Modifier that requires msg.sender has not already approved the airline
    modifier requireNotDuplicate(address _airlineAcct, address approver) {
        bool isDuplicate = false;
        for (uint256 i = 0; i < addressToApprovers[_airlineAcct].length; i++) {
            if (addressToApprovers[_airlineAcct][i] == approver) {
                isDuplicate = true;
                break;
            }
        }
        require(
            isDuplicate == false,
            "Caller has already approved this airline."
        );
        _;
    }

    //Modifier that requires msg.sender is registered
    modifier requireAirlineRegistered(address seedSender) {
        require(
            airlines[seedSender].registered == true,
            "Airline needs to be registered"
        );
        _;
    }

    //Modifier that requires airline has not send the seed money
    modifier requireAirlineNotParticipating(address seedSender) {
        require(
            airlines[seedSender].participate == false,
            "Airline already paid the seed money"
        );
        _;
    }
    //Modifier that require the insurance paid less than INSURANCE_MAX
    modifier requireLessThanMaxInsurance(uint256 _insurancePaid) {
        require(
            _insurancePaid <= INSURANCE_MAX,
            "Insurance paid exceeded the maximum "
        );
        _;
    }

    /*******                    UTILITY FUNCTIONS         *********/

    //Get operating status of contract @return A bool that is the current operating status
    function isOperational() public view returns (bool) {
        return operational;
    }

    // Sets contract operations on/off
    //When operational mode is disabled, all write transactions except for this one will fail
    function setOperatingStatus(bool mode) external {
        operational = mode;
    }

    //Set AuthorizedContracts
    function setAuthorizedContracts(address contractAddress)
        external
        requireIsOperational
        requireContractOwner
    {
        authorizedContracts[contractAddress] = 1;
    }

    /********               SMART CONTRACT FUNCTIONS              **********/
    function setAllDataConstants(
        uint256 insuranceMax,
        uint8 insuranceMul,
        uint8 insuranceDiv
    ) external {
        INSURANCE_MAX = insuranceMax; //Max insurance the passenger can take
        INSURANCE_MULTIPLIER = insuranceMul; //Insurance Amount is 1.5X (so *3 and /2)
        INSURANCE_DIVIDER = insuranceDiv;
    }

    // Add an airline to the registration queue
    function registerAirline(bytes32 _name, address _airlineAcct)
        external
        requireIsOperational ///Check contract is operational
        requireIsRequestOwner(_airlineAcct, msg.sender) ///check requester address and msg.sender are same
        requireAirlineNotAdded(_airlineAcct) /// check the airline address is not already added
    {
        _registerAirline(_name, _airlineAcct);
    }

    //Approve airlines in registration queue for registering
    function approveAirline(
        address _airlineAcct,
        address approver,
        uint256 noConsensuRegNum,
        uint256 consensusPercent
    ) external returns (bool success, uint256 votes) {
        require(
            airlines[_airlineAcct].registered == false,
            "The airline is already registered"
        ); /// check if airline is added
        require(
            airlines[approver].registered == true,
            "Only Registered Airlines can Approve"
        ); ///check if msg.sender is registered
        if (regAirlineCount <= noConsensuRegNum) {
            airlines[_airlineAcct].registered = true;
            regAirlineCount = regAirlineCount.add(1);
            emit AirlineRegistered(_airlineAcct);
            success = true;
            votes = 0;
        } else {
            (success, votes) = _approveByConsensus(
                _airlineAcct,
                approver,
                consensusPercent
            );
        }
        return (success, votes);
    }

    //Collect seed money from airlines to participate in contract
    function collectSeedMoney(address _airlineAcct)
        external
        payable
        requireIsOperational
        requireIsRequestOwner(_airlineAcct, msg.sender) ///check requester address and msg.sender are same
        requireAirlineRegistered(_airlineAcct) ///check airline is alredy registered
        requireAirlineNotParticipating(_airlineAcct) /// check airline has already paid by checking participate
    {
        airlines[_airlineAcct].participate = true;
        //contractOwner.transfer(msg.value);
        airlines[_airlineAcct].funded = msg.value;
        emit AirlineFunded(_airlineAcct);
    }

    //Passenger buy flight ticket with/without insurance
    function bookFlight(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        address _passengerAcct,
        uint256 _insurancePaid,
        uint256 _price
    )
        external
        payable
        requireIsOperational
        requireIsRequestOwner(_passengerAcct, msg.sender) ///require passenger address and msg.sender to be same
        requireLessThanMaxInsurance(_insurancePaid) ///require insurance paid is less than INSURANCE_MAX
    {
        bytes32 flightKeyPassenger = keccak256(
            abi.encodePacked(_passengerAcct, _airlineAcct, _flight, _timeStamp)
        );
        require(
            passengers[flightKeyPassenger].insuredAmount == 0,
            "Passenger is already insured for this flight"
        );
        uint256 _insuredAmount = 0;
        if (_insurancePaid != 0) {
            _insuredAmount = _price.mul(INSURANCE_MULTIPLIER).div(
                INSURANCE_DIVIDER
            );
            bytes32 flightKey = getFlightKey(_airlineAcct, _flight, _timeStamp);
            flKeyToPassAddress[flightKey].push(_passengerAcct);
        }
        Passenger memory newPassenger;
        newPassenger.creditPaid = 0;
        newPassenger.insurancePaid = _insurancePaid;
        newPassenger.insuredAmount = _insuredAmount;
        passengers[flightKeyPassenger] = newPassenger;
        _airlineAcct.transfer(msg.value);
    }

    // Credits payouts to insurees
    function creditInsurees(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        address _passengerAcct
    )
        external
        payable
        requireIsOperational
        requireIsRequestOwner(_airlineAcct, msg.sender)
    {
        bytes32 flightKeyPassenger = keccak256(
            abi.encodePacked(_passengerAcct, _airlineAcct, _flight, _timeStamp)
        );
        require(
            passengers[flightKeyPassenger].insuredAmount == msg.value,
            "Credited amount is different from insured amount"
        );

        passengers[flightKeyPassenger].insuredAmount = 0;
        passengers[flightKeyPassenger].creditPaid = msg.value;
    }

    //Transfers eligible payout funds to insuree
    function withdraw(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        address _passengerAcct,
        uint256 _amount
    )
        public
        payable
        requireIsOperational
        requireIsRequestOwner(_passengerAcct, msg.sender)
    {
        bytes32 flightKeyPassenger = keccak256(
            abi.encodePacked(_passengerAcct, _airlineAcct, _flight, _timeStamp)
        );
        require(
            passengers[flightKeyPassenger].creditPaid != 0,
            "No payment is received yet"
        );
        require(
            passengers[flightKeyPassenger].creditPaid == _amount,
            "Credit paid to passenger should be same as amount"
        );

        passengers[flightKeyPassenger].creditPaid = 0;
        _passengerAcct.transfer(_amount);
    }

    // Initial funding for the insurance. Unless there are too many delayed flights
    //    resulting in insurance payouts, the contract should be self-sustaining

    // Fallback function for funding smart contract.
    function() external payable {
        // withdraw();
    }

    //Delete the PassAddress[] once statusCode/credit payment is done
    function deleteFlKeyToPassAddress(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp
    ) external {
        bytes32 flightKey = getFlightKey(_airlineAcct, _flight, _timeStamp);
        delete flKeyToPassAddress[flightKey];
    }

    //On load get all airlines added to populate fields
    function getAirlinesOnLoad() public view returns (address[] memory) {
        return addedToAirlineAddress["Added"];
    }

    //On load get airline status to populate fields
    function getAirlinesStatusOnLoad(address _airlineAcct)
        public
        view
        returns (
            bool registered,
            bool participate,
            bytes32 name
        )
    {
        registered = airlines[_airlineAcct].registered;
        participate = airlines[_airlineAcct].participate;
        name = airlines[_airlineAcct].name;
        return (registered, participate, name);
    }

    //Get Registration Status and Votes of the airline and registered airline count
    function getAirlineRegistrationStatus(address _airlineAcct)
        external
        view
        requireIsOperational
        returns (
            bool registered,
            uint256 votes,
            uint256 registeredCount
        )
    {
        registered = airlines[_airlineAcct].registered;
        votes = addressToApprovers[_airlineAcct].length;
        return (registered, votes, regAirlineCount);
    }

    //Get all Passengers with the flight
    function getFlightInsurees(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp
    ) external view requireIsOperational returns (address[] memory) {
        bytes32 flightKey = getFlightKey(_airlineAcct, _flight, _timeStamp);
        return flKeyToPassAddress[flightKey];
    }

    //Get Insured Amount of insuree
    function getInsuredAmount(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        address _passengerAcct
    ) external view requireIsOperational returns (uint256) {
        bytes32 flightKeyPassenger = keccak256(
            abi.encodePacked(_passengerAcct, _airlineAcct, _flight, _timeStamp)
        );
        return passengers[flightKeyPassenger].insuredAmount;
    }

    //Get Credited Amount of Insuree
    function checkCreditAmount(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        address _passengerAcct
    ) external view requireIsOperational returns (uint256) {
        bytes32 flightKeyPassenger = keccak256(
            abi.encodePacked(_passengerAcct, _airlineAcct, _flight, _timeStamp)
        );
        return passengers[flightKeyPassenger].creditPaid;
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function _registerAirline(bytes32 _name, address _airlineAcct) private {
        if (regAirlineCount == 0) {
            Airline memory firstAirline;
            firstAirline.name = _name;
            firstAirline.registered = true;
            firstAirline.participate = false;
            firstAirline.funded = 0;
            airlines[_airlineAcct] = firstAirline;
            regAirlineCount = regAirlineCount.add(1);
            addedToAirlineAddress["Added"].push(_airlineAcct);
        } else {
            Airline memory newAirline;
            newAirline.name = _name;
            newAirline.registered = false;
            newAirline.participate = false;
            newAirline.funded = 0;
            airlines[_airlineAcct] = newAirline;
            addedToAirlineAddress["Added"].push(_airlineAcct);
        }
        emit AirlineAdded(_airlineAcct);
    }

    function _approveByConsensus(
        address _airlineAcct,
        address approver,
        uint256 consensusPercent
    )
        private
        requireNotDuplicate(_airlineAcct, approver) ///check if msg.sender has already approved this airline
        returns (bool success, uint256 votes)
    {
        uint256 neededVotes = _roundupToHigher(
            regAirlineCount,
            consensusPercent
        );
        addressToApprovers[_airlineAcct].push(approver);
        if (addressToApprovers[_airlineAcct].length >= neededVotes) {
            delete addressToApprovers[_airlineAcct];
            airlines[_airlineAcct].registered = true;
            regAirlineCount = regAirlineCount.add(1);
            success = true;
            votes = 0;
            emit AirlineRegistered(_airlineAcct);
        } else {
            success = false;
            votes = addressToApprovers[_airlineAcct].length;
        }
        return (success, votes);
    }

    //Round the votes to the higher number
    function _roundupToHigher(uint256 count, uint256 percentage)
        private
        returns (
            uint256 neededVotes /// to round votes to 3 instead of 2, if 50% is 2.3
        )
    {
        uint256 percentMul = count.mul(percentage);
        uint256 beforeRounding = percentMul.div(100);
        if (beforeRounding.mul(100) == percentMul) {
            neededVotes = beforeRounding;
        } else {
            neededVotes = beforeRounding.add(1);
        }
        return (neededVotes);
    }
}
