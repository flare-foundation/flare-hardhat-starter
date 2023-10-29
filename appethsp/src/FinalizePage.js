import React from 'react';
import { contract } from './ethereum';

const FinalizePage = () => {
    const handleFinalize = async () => {
        const tx = await contract.finalizeContest();
        await tx.wait();
    };

    return (
        <div>
            <button onClick={handleFinalize}>Finalize Contest</button>
            {/* ...code to display winners... */}
        </div>
    );
};

export default FinalizePage;
