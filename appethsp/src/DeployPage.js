import React, { useState } from 'react';
import { contract } from './ethereum';
import 'bootstrap/dist/css/bootstrap.min.css';


const DeployPage = () => {
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [nftPrice, setNftPrice] = useState('');
    const [totalNfts, setTotalNfts] = useState('');
    const [prizeDistribution, setPrizeDistribution] = useState('');
    const [lineUp, setLineUp] = useState([{ name: '', address: '', url: '', pic: '' }]);


    const handleDeploy = async () => {
        const tx = await contract.deploy(eventName, eventDate, nftPrice, totalNfts, prizeDistribution);
        await tx.wait();
    };

    const handleAddArtist = () => {
        setLineUp([...lineUp, { name: '', address: '', url: '', pic: '' }]);
    };

    const handleArtistChange = (index, field, value) => {
        const newLineUp = [...lineUp];
        newLineUp[index][field] = value;
        setLineUp(newLineUp);
    };

    return (
        <div className="container">
            <h2 className="mb-4">Deploy Event Smart Contract</h2>
            <form>
                <div className="mb-3">
                    <label className="form-label">Event Name</label>
                    <input type="text" className="form-control" value={eventName} onChange={(e) => setEventName(e.target.value)} />
                </div>
                <div className="mb-3">
                    <label className="form-label">Event Date</label>
                    <input type="date" className="form-control" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div className="mb-3">
                    <label className="form-label">Ticket Price (ETH)</label>
                    <input type="number" className="form-control" value={nftPrice} onChange={(e) => setNftPrice(e.target.value)} />
                </div>
                <div className="mb-3">
                    <label className="form-label">Total Tickets</label>
                    <input type="number" className="form-control" value={totalNfts} onChange={(e) => setTotalNfts(e.target.value)} />
                </div>
                <div className="mb-3">
                    <label className="form-label">Prize Distribution (%)</label>
                    <input type="text" className="form-control" placeholder="e.g., 80,15,5" value={prizeDistribution} onChange={(e) => setPrizeDistribution(e.target.value)} />
                </div>
                <hr />
                <h4 className="mb-4">Artist Line-up</h4>
                {lineUp.map((artist, index) => (
                    <div className="mb-3" key={index}>
                        <div className="mb-2">
                            <label className="form-label">Artist Name</label>
                            <input type="text" className="form-control" value={artist.name} onChange={(e) => handleArtistChange(index, 'name', e.target.value)} />
                        </div>
                        <div className="mb-2">
                            <label className="form-label">Wallet Address</label>
                            <input type="text" className="form-control" value={artist.address} onChange={(e) => handleArtistChange(index, 'address', e.target.value)} />
                        </div>
                        <div className="mb-2">
                            <label className="form-label">Promo URL</label>
                            <input type="url" className="form-control" value={artist.url} onChange={(e) => handleArtistChange(index, 'url', e.target.value)} />
                        </div>
                        <div className="mb-2">
                            <label className="form-label">Artist Picture URL</label>
                            <input type="url" className="form-control" value={artist.pic} onChange={(e) => handleArtistChange(index, 'pic', e.target.value)} />
                        </div>
                    </div>
                ))}
                <button type="button" className="btn btn-secondary mb-4" onClick={handleAddArtist}>Add Another Artist</button>
                <hr />
                <button type="button" className="btn btn-primary" onClick={handleDeploy}>Deploy</button>
            </form>
        </div>
    );
};

export default DeployPage;
