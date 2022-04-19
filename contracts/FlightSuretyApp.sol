// SPDX-License-Identifier: MIT
pragma solidity ^0.4.25;

// OpenZeppelin's SafeMath library, when used correctly, protects againstnumeric overflow bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/*****      FlightSurety Smart Contract     *****/

contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /*****    DATA VARIABLES     *****/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 public constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false
    uint256 public constant SEED_AIRLINE_MONEY = 10 ether; //seed money for airlines to participate
    uint256 public constant INSURANCE_MAX = 1 ether; //Max insurance the passenger can take
    uint8 public constant INSURANCE_MULTIPLIER = 3; //Insurance Amount is 1.5X (so *3 and /2)
    uint8 public constant INSURANCE_DIVIDER = 2;

    uint8 public constant CONSENSUS_PERCENTAGE = 50; // consenses percentage for approval
    uint8 public constant NO_CONSENSUS_REGISTER_NUMBER = 4; //number of airlines that can be approved by registered airline

    FlightSuretyData flightSuretyData;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
    }
    mapping(bytes32 => Flight) private flights;

    /*****           FUNCTION MODIFIERS           *****/
    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    //Modifier that require contract to be operational
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(true, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    //Modifier that requires the "ContractOwner" account to be the function caller
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }
    //Modifier that require the operational mode to be different
    modifier requireDiffOperationalMode(bool mode) {
        require(
            mode != operational,
            "New mode must be different from existing mode"
        );
        _;
    }

    /*****      CONSTRUCTOR  *****/

    constructor(address dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
        flightSuretyData.setAllDataConstants(
            INSURANCE_MAX,
            INSURANCE_MULTIPLIER,
            INSURANCE_DIVIDER
        );
    }

    /*****        UTILITY FUNCTIONS        *****/
    // Get operating status of contract
    function isOperational() public view returns (bool) {
        return operational;
    }

    // Sets contract operations on/off
    function setOperatingStatus(bool mode)
        external
        requireContractOwner
        requireDiffOperationalMode(mode)
    {
        operational = mode;
        flightSuretyData.setOperatingStatus(mode);
    }

    /******         SMART CONTRACT FUNCTIONS         ******/

    //Approve an airline for registration
    function approveAirline(address _airlineAcct)
        external
        requireIsOperational
        returns (
            bool success,
            uint256 votes ///return only if view or pure -keeping code for reference
        )
    {
        (success, votes) = flightSuretyData.approveAirline(
            _airlineAcct,
            msg.sender,
            NO_CONSENSUS_REGISTER_NUMBER,
            CONSENSUS_PERCENTAGE
        );
        return (success, votes);
    }

    // Register a flight for insuring.
    function registerFlight(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp,
        uint8 _statusCode
    ) external requireIsOperational {
        bytes32 _flightKey = getFlightKey(_airlineAcct, _flight, _timeStamp);
        require(
            _airlineAcct == msg.sender, //require flight registered by owner airline
            "The flight is already registered"
        );
        require(
            flights[_flightKey].isRegistered != true, //require flight not registered already
            "The flight is already registered"
        );
        Flight memory _flights;
        _flights.isRegistered = true;
        _flights.updatedTimestamp = _timeStamp;
        _flights.statusCode = _statusCode;
        flights[_flightKey] = _flights;
    }

    // Generate a request for oracles to fetch flight information
    function requestOracleFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external requireIsOperational {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        require(
            flights[flightKey].statusCode == 0, //require flight status unknown
            "Flight status is already updated"
        );
        require(
            flights[flightKey].isRegistered == true, //require flight is registered
            "Flight is not registered"
        );
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    //Used to populate field based on flight registration @return isRegistered bool
    function getFlightRegistrationOnLoad(
        address _airlineAcct,
        string _flight,
        uint256 _timeStamp
    ) public view returns (bool) {
        bytes32 flightKey = getFlightKey(_airlineAcct, _flight, _timeStamp);
        return flights[flightKey].isRegistered;
    }

    //Check if status is updated from the minimum oracle responses @return statusCode
    function checkFlightStatusResponse(
        address _airlineAcct,
        string _flight,
        uint256 _timestamp
    ) external view requireIsOperational returns (uint256 _statusCode) {
        bytes32 flightKey = getFlightKey(_airlineAcct, _flight, _timestamp);
        require(
            flights[flightKey].isRegistered == true,
            "Flight is not registered"
        );
        _statusCode = flights[flightKey].statusCode;
        return (_statusCode);
    }

    // Called after oracle has updated flight status to update statusCode
    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) internal {
        bytes32 _flightKey = getFlightKey(airline, flight, timestamp);
        flights[_flightKey].statusCode = statusCode;
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint256 registrationFee;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    function loadInit()
        external
        view
        requireIsOperational
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            REGISTRATION_FEE,
            MIN_RESPONSES,
            STATUS_CODE_UNKNOWN,
            STATUS_CODE_ON_TIME,
            STATUS_CODE_LATE_AIRLINE,
            STATUS_CODE_LATE_WEATHER,
            STATUS_CODE_LATE_TECHNICAL,
            STATUS_CODE_LATE_OTHER
        );
    }

    // Register an oracle with the contract
    function registerOracle() external payable requireIsOperational {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");
        require(
            oracles[msg.sender].isRegistered == false,
            "Oracle already registered"
        );

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
            isRegistered: true,
            registrationFee: msg.value,
            indexes: indexes
        });
    }

    function getMyIndexes()
        external
        view
        requireIsOperational
        returns (uint8[3] memory)
    {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external requireIsOperational {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(
            oracleResponses[key].isOpen,
            "Flight status Oracle request is closed"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);
            oracleResponses[key].isOpen = false;
            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account)
        internal
        returns (uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }
    // endregion
}

contract FlightSuretyData {
    function setOperatingStatus(bool mode) external;

    function setAllDataConstants(
        uint256 insuranceMax,
        uint8 insuranceMul,
        uint8 insuranceDiv
    ) external;

    function approveAirline(
        address _airlineAcct,
        address approver,
        uint256 noConsensuRegNum,
        uint256 consensusPercent
    ) external returns (bool success, uint256 votes);
}
