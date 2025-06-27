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
        name: 'KYCtest1',
        clarityCode: `

;; title: KYC
;; version:1
;; summary: This is the KYC contract which stores user and asset KYC data for those who want to tokenize assets or buy APT tokens. It excludes users intending to buy PXT tokens.

;;Reamainig work after the Token contract deployed
;; 1. i have to imports all the admins owner will add for the verifications of kyc. For now the contract is not deplooyed to when i was using moke address, it clearly shows error so this task will be done later.

(define-constant PXT-contract 'ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.pxttest1)
;;errors
(define-constant err-kyc-not-found (err u101))
(define-constant err-kyc-already-approved (err u102))
(define-constant err-kyc-not-pending (err u103))
(define-constant err-owner-or-admin-only (err u104))
;;

;; data vars
(define-data-var contract-owner principal tx-sender)
;;

;; data maps
(define-map whitelist principal bool)
(define-map whitelist-assets principal bool)
(define-map kyc-submissions-users principal {ipfs-hash: (string-utf8 100), status: (string-utf8 20)})
(define-map kyc-submissions-assets principal {ipfs-hash: (string-utf8 100), status: (string-utf8 20)})
;;


;;Read only functions
(define-read-only (is-eligible-for-apt (user principal)) (default-to false (map-get? whitelist user)))
(define-read-only (is-eligible-to-tokenize (user principal)) (and (default-to false (map-get? whitelist user)) (default-to false  (map-get? whitelist-assets user))))
;;


;; public functions
;; Kyc functions for the user
(define-public (submit-kyc-of-user (ipfs-hash (string-utf8 100)))
  (begin
    (let ((empty-kyc (tuple (ipfs-hash u"")  (status u"none"))))
    (asserts! (is-eq (get status (default-to empty-kyc (map-get? kyc-submissions-users tx-sender))) u"none") err-kyc-already-approved))
    (map-set kyc-submissions-users tx-sender (tuple (ipfs-hash ipfs-hash) (status u"pending")))
    (print (tuple (event-type "UserKYCSubmitted") (user tx-sender) (ipfs-hash ipfs-hash)))
    (ok true)
  )
)

;; Function to approve KYC (admin only)
(define-public (approve-kyc-of-user (user principal))
  (begin
    (asserts! (and (is-eq tx-sender (var-get contract-owner)) (contract-call? PXT-contract is-admin tx-sender))  err-owner-or-admin-only) 
    (let ((kyc-data (unwrap! (map-get? kyc-submissions-users user) err-kyc-not-found)))
      (asserts! (is-eq (get status kyc-data) u"pending") err-kyc-not-pending)
      (map-set kyc-submissions-users user (tuple (ipfs-hash (get ipfs-hash kyc-data)) (status u"approved")))
      (map-set whitelist user true)
      (print {event-type: "UserKYCApproved", user: user, by: tx-sender})
      (ok true)
    )
  )
)

;; Function to reject KYC (admin only)
(define-public (reject-kyc-of-user (user principal) (reason (string-utf8 1000)))
  (begin
    (asserts! (and (is-eq tx-sender (var-get contract-owner)) (contract-call? PXT-contract is-admin tx-sender))  err-owner-or-admin-only) 
    (let ((kyc-data (unwrap! (map-get? kyc-submissions-users user) err-kyc-not-found)))
      (asserts! (is-eq (get status kyc-data) u"pending") err-kyc-not-pending)
      (map-set kyc-submissions-users user (tuple (ipfs-hash (get ipfs-hash kyc-data)) (status u"rejected")))
      (print {event-type: "UserKYCRejected", user: user, by: tx-sender, reason: reason})
      (ok true)
    )
  )
)

;;Function to submit kyc for the assets
(define-public (submit-kyc-for-assets (ipfs-hash (string-utf8 100)))
  (begin 
    (let ((empty-kyc (tuple (ipfs-hash u"")  (status u"none"))))
    (asserts! (is-eq (get status (default-to empty-kyc (map-get? kyc-submissions-assets tx-sender))) u"none") err-kyc-already-approved))
    (map-set kyc-submissions-assets tx-sender (tuple (ipfs-hash ipfs-hash) (status u"pending")))
    (print (tuple (event-type "AssetsKYCSubmitted") (user tx-sender) (ipfs-hash ipfs-hash)))
    (ok true)
  )
)

;; Function to approve KYC (admin only)
(define-public (approve-kyc-of-assets (user principal))
  (begin
    (asserts! (and (is-eq tx-sender (var-get contract-owner)) (contract-call? PXT-contract is-admin tx-sender))  err-owner-or-admin-only)
    (let ((kyc-data (unwrap! (map-get? kyc-submissions-assets user) err-kyc-not-found)))
      (asserts! (is-eq (get status kyc-data) u"pending") err-kyc-not-pending)
      (map-set kyc-submissions-assets user (tuple (ipfs-hash (get ipfs-hash kyc-data)) (status u"approved")))
      (map-set whitelist-assets user true)
      (print {event-type: "AssetsKYCApproved", user: user, by: tx-sender})
      (ok true)
    )
  )
)

;; Function to reject KYC (admin only)
(define-public (reject-kyc-of-assets (user principal) (reason (string-utf8 1000)))
  (begin
    (asserts! (and (is-eq tx-sender (var-get contract-owner)) (contract-call? PXT-contract is-admin tx-sender))  err-owner-or-admin-only)
    (let ((kyc-data (unwrap! (map-get? kyc-submissions-assets user) err-kyc-not-found)))
      (asserts! (is-eq (get status kyc-data) u"pending") err-kyc-not-pending)
      (map-set kyc-submissions-assets user (tuple (ipfs-hash (get ipfs-hash kyc-data)) (status u"rejected")))
      (print {event-type: "AssetsKYCRejected", user: user, by: tx-sender, reason: reason})
      (ok true)
    )
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