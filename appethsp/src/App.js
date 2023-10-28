import logo from './logo.svg';
import './App.css';
import { connectWallet } from './ethereum';
import React, { useState } from 'react';
import { contract, provider } from './ethereum';
import { ethers } from 'ethers';


const App = () => {
    const [artist, setArtist] = useState('');

    const handleBuyTicket = async () => {
        const signer = provider.getSigner();
        const tx = await contract.connect(signer).buyTicket({ value: ethers.utils.parseEther("0.1") });  // Assume ticket price is 0.1 ETH
        await tx.wait();
    };

    const handleVote = async () => {
        const signer = provider.getSigner();
        const tx = await contract.connect(signer).castVote(artist);
        await tx.wait();
    };

    return (
        <div>
            <button onClick={handleBuyTicket}>Buy Ticket</button>
            <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist address" />
            <button onClick={handleVote}>Vote</button>
        </div>
    );
};

export default App;


// function App() {
//   const [connected, setConnected] = useState(false);

//   const handleConnect = async () => {
//     const provider = await connectWallet();
//     if (provider) {
//       setConnected(true);
//     }
//   };
//   return (

//     <div className="App">
//     <button onClick={handleConnect}>
//       {connected ? 'Connected' : 'Connect to MetaMask'}
//     </button>
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React111
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;




