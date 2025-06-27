import { useState, useEffect } from 'react';
import { connect, disconnect, getLocalStorage, request } from '@stacks/connect';
import { STACKS_TESTNET } from '@stacks/network';


export default function DeployToken() {
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [status, setStatus] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const contractTemplate = `;; title: APT-Token
;; version: 1
(impl-trait 'ST1VZ3YGJKKC8JSSWMS4EZDXXJM7QWRBEZ0ZWM64E.real-world-asset-trait.real-world-asset-trait)

(define-fungible-token <<TOKEN_NAME>>)

;; Token Metadata
(define-data-var name (string-ascii 32) "APT-<<SYMBOL>>")
(define-data-var symbol (string-ascii 32) "<<SYMBOL>>")
(define-data-var total-supply uint u0)
(define-data-var owner principal tx-sender)
(define-constant decimals u6)

;; Error Codes
(define-constant err-unauthorized (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-not-initialized (err u103))

;; Initialization Guard
(define-data-var initialized bool false)

;; Initialize Token (One-time setup)
(define-public (init-token (asset-symbol (string-ascii 10)))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) err-unauthorized)
    (asserts! (not (var-get initialized)) err-unauthorized)
    
    ;; Set token metadata
    (var-set symbol asset-symbol)
    (var-set name (concat "APT-" asset-symbol))
    (var-set initialized true)
    
    (ok true)
  )
)

;; Tokenize Asset (Mint initial supply)
(define-public (tokenize-asset (valuation uint))
  (begin
    (asserts! (var-get initialized) err-not-initialized)
    (asserts! (is-eq tx-sender (var-get owner)) err-unauthorized)
    (asserts! (> valuation u0) err-invalid-amount)
    
    (ft-mint? <<TOKEN_NAME>> tx-sender valuation)
    (var-set total-supply valuation)
    (ok true)
  )
)

;; Transfer Tokens (SIP-010 compliant)
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-unauthorized)
    (asserts! (> amount u0) err-invalid-amount)
    (ft-transfer? <<TOKEN_NAME>> amount sender recipient)
  )
)

;; Read-only functions (SIP-010 compliant)
(define-read-only (get-name)
  (ok (var-get name))
)

(define-read-only (get-symbol)
  (ok (var-get symbol))
)

(define-read-only (get-decimals)
  (ok decimals)
)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance <<TOKEN_NAME>> who))
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Optional: Burn function
(define-public (burn (amount uint) (owner principal))
  (begin
    (asserts! (is-eq tx-sender owner) err-unauthorized)
    (asserts! (> amount u0) err-invalid-amount)
    (ft-burn? <<TOKEN_NAME>> amount owner)
  )
)

;; Optional: Get owner
(define-read-only (get-owner)
  (ok (var-get owner))
)`;

  // Wallet connection handlers
  const handleConnect = async () => {
    try {
      await connect({
        appDetails: {
          name: 'APT Token Factory',
          icon: window.location.origin + '/logo.png',
        },
      });
      
      const data = getLocalStorage();
      if (data?.addresses?.stx?.[0]?.address) {
        setWalletAddress(data.addresses.stx[0].address);
        setIsConnected(true);
        setStatus('Wallet connected successfully');
      }
    } catch (err) {
      setStatus('Connection error: ' + err.message);
      console.error(err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setIsConnected(false);
      setWalletAddress('');
      setStatus('Wallet disconnected');
    } catch (err) {
      setStatus('Disconnection error: ' + err.message);
    }
  };

  // Check existing connection on mount
  useEffect(() => {
    const data = getLocalStorage();
    if (data?.addresses?.stx?.[0]?.address) {
      setWalletAddress(data.addresses.stx[0].address);
      setIsConnected(true);
    }
  }, []);

  // Deployment function
  const handleDeploy = async () => {
    try {
      setStatus('Preparing deployment...');
      
      if (!isConnected || !walletAddress) {
        throw new Error('Wallet not connected');
      }

      const tokenName = `${symbol.toLowerCase()}`;
      const clarityCode = contractTemplate
        .replace(/<<TOKEN_NAME>>/g, '' + tokenName)
      .replace(/<<SYMBOL>>/g, '' + symbol.toUpperCase())

      const codeBody = clarityCode;
       console.log("Final Clarity Code:\n", codeBody)

      setStatus('Deploying contract...');
      
      const response = await request('stx_deployContract', {
        name: tokenName,
        clarityCode: codeBody ,
        clarityVersion: '3',
        network: 'testnet'
      });

      if (!response?.txid) {
        throw new Error('Deployment failed - no transaction ID received');
      }

      setSymbol('');
      setSupply('');
      setStatus(`Contract deployed successfully! TXID: ${response.txid}`);
      
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    }
  };

  return (
  <div className="max-w-lg mx-auto p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700">
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
        APT Token Factory
      </h2>
      <p className="text-gray-400 mt-2">
        Tokenize your real-world assets on Stacks
      </p>
    </div>

    {/* Wallet Connection */}
    {isConnected ? (
      <div className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-gray-300">Connected</span>
          </div>
          <span className="text-sm font-mono text-gray-400 truncate max-w-xs">
            {walletAddress}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          <span>Disconnect Wallet</span>
        </button>
      </div>
    ) : (
      <button
        onClick={handleConnect}
        className="w-full mb-6 py-3 px-6 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-medium rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <span>Connect Wallet</span>
      </button>
    )}

    {/* Deployment Form */}
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Token Name
        </label>
        <div className="relative">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            placeholder="GOLD"
            disabled={!isConnected}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-gray-500 text-xs">APT-</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Initial Supply
        </label>
        <input
          type="number"
          value={supply}
          onChange={(e) => setSupply(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          placeholder="1000000"
          disabled={!isConnected}
        />
      </div>
      
      <button
        onClick={handleDeploy}
        disabled={!isConnected || !symbol || !supply}
        className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
        </svg>
        <span>Deploy Token</span>
      </button>
    </div>
    
    {status && (
      <div className={`mt-6 p-4 rounded-lg ${status.includes('Error') ? 'bg-red-900/30 border border-red-800' : 'bg-gray-800 border border-gray-700'}`}>
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 ${status.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {status.includes('Error') ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="text-sm text-gray-300 break-all">{status}</div>
        </div>
      </div>
    )}
  </div>
);
}