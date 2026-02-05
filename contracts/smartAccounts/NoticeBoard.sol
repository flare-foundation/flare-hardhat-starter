// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct Notice {
    uint256 expirationTimestamp;
    string message;
}

contract NoticeBoard {
    uint256 public constant THIRTY_DAYS = 2592000;

    mapping(address => Notice) public notices;
    mapping(address => bool) public existingClients;
    address[] public clients;

    function pinNotice(string memory message) public payable {
        require(msg.value > 0);

        // NOTE:(Nik) The subscription is 1 C2FLR per month.
        uint256 duration = THIRTY_DAYS * (msg.value / 1 ether);
        uint256 expirationTimestamp = block.timestamp + duration;

        notices[msg.sender] = Notice(expirationTimestamp, message);
        if (!existingClients[msg.sender]) {
            clients.push(msg.sender);
            existingClients[msg.sender] = true;
        }
    }

    function getNotices() public view returns (Notice[] memory) {
        Notice[] memory _notices = new Notice[](clients.length);
        for (uint256 i = 0; i < clients.length; ++i) {
            Notice memory notice = notices[clients[i]];
            if (notice.expirationTimestamp > block.timestamp) {
                _notices[i] = notice;
            }
        }
        return _notices;
    }
}
