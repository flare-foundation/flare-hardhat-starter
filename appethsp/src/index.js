import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
//import { EtherspotTransactionKit } from "@etherspot/transaction-kit";
import { ethers } from "ethers";
import { connectWallet } from './ethereum';


// const randomWallet = ethers.Wallet.createRandom();
// const providerWallet = new ethers.Wallet(randomWallet.privateKey);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();






