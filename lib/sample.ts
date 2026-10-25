export const VULNERABLE_CONTRACT_SAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockTime;
    address public owner;
    uint256 public feeRate;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
        feeRate = 1;
    }

    // Vulnerability 1: Reentrancy (external call before state mutation, no nonReentrant)
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // External call performed before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] -= amount;
        emit Withdraw(msg.sender, amount);
    }

    // Vulnerability 2: tx.origin used for authentication
    function transferOwnership(address newOwner) public {
        require(tx.origin == owner, "Only owner can transfer ownership");
        owner = newOwner;
    }

    // Vulnerability 3: Unchecked low-level send return value
    function refundFee(address payable recipient, uint256 amount) public {
        require(msg.sender == owner, "Only owner");
        // send return value ignored
        recipient.send(amount);
    }

    // Vulnerability 4: Unprotected selfdestruct callable by any address
    function destroyContract(address payable recipient) public {
        // Missing access control check
        selfdestruct(recipient);
    }

    // Vulnerability 5: Missing access control on sensitive public function
    function setFeeRate(uint256 newFee) public {
        // Any caller can change protocol fee rate
        feeRate = newFee;
    }

    // Vulnerability 6: Unprotected delegatecall to user-supplied address
    function executeDelegate(address target, bytes memory data) public {
        // Allows arbitrary state mutation from untrusted code
        (bool ok, ) = target.delegatecall(data);
        require(ok, "Delegatecall failed");
    }

    // Note: Compiler pragma is ^0.7.6 without SafeMath, vulnerable to arithmetic overflow
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
}
`;
