import React from 'react';
import { contract } from './ethereum';
import { ethers } from 'ethers';


const BuyTicketPage = () => {
    const handleBuyTicket = async () => {
        const tx = await contract.buyTicket({ value: ethers.utils.parseEther("0.1") });
        await tx.wait();
    };

    return (
        <div>
            <button onClick={handleBuyTicket}>Buy Ticket</button>
        </div>
    );
};

export default BuyTicketPage;
