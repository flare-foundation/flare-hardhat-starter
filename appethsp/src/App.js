import logo from './logo.svg';
import './App.css';
import { connectWallet } from './ethereum';

import React, { useState } from 'react';
import { contract, provider } from './ethereum';
import { ethers } from 'ethers';


import DeployPage from './DeployPage';
import BuyTicketPage from './BuyTicketPage';
import VotePage from './VotePage';
import FinalizePage from './FinalizePage';
import 'bootstrap/dist/css/bootstrap.min.css';



const App = () => {
    const [page, setPage] = useState('deploy');

    const renderPage = () => {
        switch(page) {
            case 'buy':
                return <BuyTicketPage />;
            case 'vote':
                return <VotePage />;
            case 'finalize':
                return <FinalizePage />;
            case 'deploy':
            default:
                return <DeployPage />;
        }
    };

    return (
        <div className="container mt-5">
            <div className="btn-group mb-4" role="group" aria-label="Basic example">
                <button type="button" className="btn btn-primary" onClick={() => setPage('deploy')}>Deploy</button>
                <button type="button" className="btn btn-secondary" onClick={() => setPage('buy')}>Buy Ticket</button>
                <button type="button" className="btn btn-secondary" onClick={() => setPage('vote')}>Vote</button>
                <button type="button" className="btn btn-secondary" onClick={() => setPage('finalize')}>Finalize</button>
            </div>
            {renderPage()}
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




