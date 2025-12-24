# Utils

This directory contains utility functions used across different scripts and tasks within the project.

## Directory structure

```
utils
├── core.ts: Core utility functions for hex conversion, sleep, event parsing/logging from raw transaction logs, and file operations.
├── fdc.ts: FDC (Flare Data Connector) utilities for preparing attestation requests, submitting to FDC Hub, calculating round IDs, and retrieving proofs from the DA Layer.
├── getters.ts: Getter functions for all Flare protocol contracts (FTSO, FDC, governance, staking, rewards, F-Assets, etc.) using the FlareContractRegistry.
└── README.md
```