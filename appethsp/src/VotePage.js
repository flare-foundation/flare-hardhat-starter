import React, { useState } from 'react';
import { contract } from './ethereum';

const VotePage = () => {
    const [artist, setArtist] = useState('');

    const handleVote = async () => {
        const tx = await contract.castVote(artist);
        await tx.wait();
    };

    return (
        <div>
            <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist address" />
            <button onClick={handleVote}>Vote</button>
        </div>
    );
};

export default VotePage;
