import { useState, useEffect } from 'react';
import { connect, disconnect, getLocalStorage, request } from '@stacks/connect';
import { STACKS_TESTNET } from '@stacks/network';


export default function DeployToken() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');


  // Wallet connection handlers
  const handleConnect = async () => {
    try {
      await connect({
        appDetails: {
          name: ' Token Factory',
          icon: window.location.origin + '/logo.png',
        },
      });
      
      const data = getLocalStorage();
      if (data?.addresses?.stx?.[0]?.address) {
        setWalletAddress(data.addresses.stx[0].address);
        setIsConnected(true);
 
      }
    } catch (err) {
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
       console.error(err);
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

      if (!isConnected || !walletAddress) {
        throw new Error('Wallet not connected');
      }
      
      const response = await request('stx_deployContract', {
        name: 'Marketplace1',
        clarityCode: `

;; Makrketplace contract where users can list, unlist and can sell their nfts
;; clarity version 3

(define-constant contract 'ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.SimpleNFT)
(define-constant contract-owner tx-sender)
(define-constant PLATFORM-FEE-BPS  u250) ;;2.5% basic fee for now

;;eRROR
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-LISTING-EXPIRED (err u402))
(define-constant ERR-PRICE-MISMATCHED (err u403))
(define-constant ERR-ALREADY-LISTED (err u404))
(define-constant ERR-NFT-TRANSFER-FAILED (err u405))
(define-constant ERR-NOT-FOUND (err u406))
(define-constant ERR-OWNER-CANNOT-BUY (err u407))
(define-constant ERR-INSUFFICIENT-FUNDS (err u408))



;;Data structures
(define-map listings {token-id: uint} 
    {seller: principal, price: uint, expiry: uint, is-active: bool}
)

;;Track paltform fee
(define-data-var total-platform-fees  uint u0)

;;check if token is listed
(define-read-only (is-listed (token-id uint)) 
    (match (map-get? listings { token-id: token-id})
        listing (and (get is-active listing)
            (< stacks-block-height (get expiry listing)))
        false
    )
)

;;get listing details if active
(define-read-only (get-listing (token-id uint))
    (map-get? listings {token-id: token-id})
)

;;calculate fees for the given amount
(define-read-only (calculate-platform-fee (amount uint)) 
    (/ (* amount PLATFORM-FEE-BPS) u10000)
)
;;get total platform fee of the platform
(define-read-only (get-total-platform-fees) 
    (var-get total-platform-fees)
)

;;listing functions
;; list nft for sale
(define-public (list-nft (token-id uint) (price uint) (expiry uint))
  (let (
    (nft-owner-opt (unwrap! (contract-call? contract get-owner token-id) (err u0)))
  )
    ;; Check if the owner is none
    (asserts! (is-some nft-owner-opt) ERR-NOT-AUTHORIZED)
    (let (
      (nft-owner (unwrap! nft-owner-opt (err u0)))
    )
      ;; Validations
      (asserts! (is-eq tx-sender nft-owner) ERR-NOT-AUTHORIZED)
      (asserts! (> expiry stacks-block-height) ERR-LISTING-EXPIRED)
      (asserts! (> price u0) ERR-PRICE-MISMATCHED)
      (asserts! (not (is-listed token-id)) ERR-ALREADY-LISTED)

      ;; Transfer NFT to this contract (escrow)
      (unwrap! (contract-call? contract transfer token-id tx-sender (as-contract tx-sender)) ERR-NFT-TRANSFER-FAILED)
      
      ;; Create the listing
      (map-set listings
        { token-id: token-id }
        { 
          seller: tx-sender, 
          price: price, 
          expiry: expiry, 
          is-active: true
        }
      )
      
      (ok true)
    )
  )
)

;;cancel a listings
(define-public (cancel-listing (token-id uint))
    (let (
        (listing (unwrap! (map-get? listings { token-id: token-id}) ERR-NOT-FOUND))
    )   
    ;;only seller can cancel
    (asserts! (is-eq tx-sender (get seller listing)) ERR-NOT-AUTHORIZED)
    ;;ensure listing is active
    (asserts! (get is-active listing) ERR-NOT-FOUND)

    ;;Mark lisitng is inactive
    (map-set listings {token-id: token-id} (merge listing {is-active: false}))

    ;;Return nft to seller from escrow
    (as-contract (contract-call? contract transfer token-id tx-sender (get seller listing))))
)

;; Purchase functions

;; buy listed nft
(define-public (buy-nft (token-id uint))
  (let (
    (listing (unwrap! (map-get? listings { token-id: token-id }) ERR-NOT-FOUND))
    (price (get price listing))
    (seller (get seller listing))
    (platform-fee (calculate-platform-fee price))
    (seller-amount (- price platform-fee))
  )
    ;; Check conditions
    (asserts! (get is-active listing) ERR-NOT-FOUND)
    (asserts! (< stacks-block-height (get expiry listing)) ERR-LISTING-EXPIRED)
    (asserts! (not (is-eq tx-sender seller)) ERR-OWNER-CANNOT-BUY)
    
    ;; Update platform fees
    (var-set total-platform-fees (+ (var-get total-platform-fees) platform-fee))
    
    ;; Mark listing as inactive
    (map-set listings
      { token-id: token-id }
      (merge listing { is-active: false })
    )
    
    ;; Pay seller
    (unwrap! (stx-transfer? seller-amount tx-sender seller) ERR-INSUFFICIENT-FUNDS)
    
    ;; Pay platform fee
    (unwrap! (stx-transfer? platform-fee tx-sender contract-owner) ERR-INSUFFICIENT-FUNDS)
    
    ;; Transfer NFT to buyer from escrow
    (as-contract 
      (contract-call? contract transfer token-id tx-sender tx-sender)
    )
  )
)

;; Update a listing's price
(define-public (update-listing-price (token-id uint) (new-price uint))
  (let (
    (listing (unwrap! (map-get? listings { token-id: token-id }) ERR-NOT-FOUND))
  )
    ;; Validations
    (asserts! (is-eq tx-sender (get seller listing)) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active listing) ERR-NOT-FOUND)
    (asserts! (< stacks-block-height (get expiry listing)) ERR-LISTING-EXPIRED)
    (asserts! (> new-price u0) ERR-PRICE-MISMATCHED)
    
    ;; Update the listing price
    (map-set listings
      { token-id: token-id }
      (merge listing { price: new-price })
    )
    
    (ok true)
  )
)

;; Administration function to withdraw paltform fee

(define-public (withdraw-platform-fee) 
 (let (
    (fee-amount (var-get total-platform-fees))
 )
 (asserts! (is-eq tx-sender contract-owner) ERR-NOT-AUTHORIZED)
 (asserts! (> fee-amount u0) ERR-INSUFFICIENT-FUNDS)

 ;;Reset counter
 (var-set total-platform-fees u0)

 ;; transfer funds to contract owner
 (as-contract (stx-transfer? fee-amount tx-sender contract-owner))
 )
)
` ,
        clarityVersion: '3',
        network: 'testnet'
      });

      if (!response?.txid) {
        throw new Error('Deployment failed - no transaction ID received');
      }
      
    } catch (err) {
      console.error(err);
    }
  };

 return (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
    <div className="bg-white shadow-2xl rounded-2xl p-8 max-w-md w-full">
      <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
        Token Factory
      </h1>

      <div className="mb-4 text-center">
        {isConnected ? (
          <p className="text-green-600 font-semibold break-words">
            Connected: {walletAddress}
          </p>
        ) : (
          <p className="text-red-500 font-semibold">Wallet not connected</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          className={`py-2 rounded-xl font-semibold transition ${
            isConnected
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
        </button>

        <button
          onClick={handleDeploy}
          disabled={!isConnected}
          className="py-2 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Deploy Token
        </button>
      </div>
    </div>
  </div>
);
}