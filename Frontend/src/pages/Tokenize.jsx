import { WalletProvider } from "./contexts/WalletContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useState, useEffect } from 'react';
import { request } from "@stacks/connect";




export default function DeployToken() {
  const [tokenName, setTokenName] = useState('');
  const [supply, setSupply] = useState('');
  const [status, setStatus] = useState('');
  const contractTemplate = `
;; title: APT-Token
;; version: 1
(impl-trait 'ST1VZ3YGJKKC8JSSWMS4EZDXXJM7QWRBEZ0ZWM64E.real-world-asset-trait.real-world-asset-trait)


(define-constant kyc-contract 'ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.KYCtest1)


;; Dynamic token definition (will be replaced)
(define-fungible-token <<TOKEN_NAME>>)

;; Token metadata (will be replaced)
(define-data-var name (string-ascii 32) "<<TOKEN_NAME>>")
(define-data-var symbol (string-ascii 32) "apt-<<TOKEN_NAME>>")
(define-data-var total-supply uint <<valuation>>)
(define-data-var owner principal tx-sender)
(define-constant decimals u6)

;; Errors
(define-constant err-unauthorized (err u101))
(define-constant err-invalid-amount (err u102))

;; Tokenization function
// (define-public (tokenize-asset ( <<valuation>> uint))
//   (begin
//     (asserts! (contract-call? kyc-contract is-eligible-to-tokenize tx-sender) err-unauthorized)
//     (asserts! (is-eq tx-sender (var-get owner)) err-unauthorized)
//     (asserts! (is-eq (var-get total-supply) u0) err-unauthorized)
    
//     ;; Mint initial supply
//     ;; (ft-mint? <<TOKEN_NAME>> tx-sender valuation)
//     (var-set total-supply <<valuation>>)
//     (ok true)
//   )
// )

;; SIP-010 compliant functions
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin 
    (asserts! (contract-call? kyc-contract is-eligible-for-apt sender) err-unauthorized)
    (asserts! (contract-call? kyc-contract is-eligible-for-apt recipient) err-unauthorized)
    (ft-transfer? <<TOKEN_NAME>> amount sender recipient)

  )
  
)

(define-public (mint (amount uint) (recipient principal))
  (begin 
    (asserts! (contract-call? kyc-contract is-eligible-for-apt recipient) err-unauthorized)
    (as-contract (ft-mint? <<TOKEN_NAME>> amount recipient))
  )
)

(define-public (burn (amount uint))
  (begin 
  (asserts! (> amount u0) (err u101)) 
  (asserts! (<= amount (ft-get-balance <<TOKEN_NAME>> tx-sender)))
  (ft-burn? <<TOKEN_NAME>> amount tx-sender)
  )
  
)

(define-read-only (get-name) (ok (var-get name)))
(define-read-only (get-symbol) (ok (var-get symbol)))
(define-read-only (get-decimals) (ok decimals))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance <<TOKEN_NAME>> who)))
(define-read-only (get-total-supply) (ok (var-get total-supply)))
`;


  useEffect(() => {
    loadContract('AptToken')
      .then(template => setContractTemplate(template))
      .catch(err => setStatus(`Error loading contract: ${err.message}`));
  }, []);

  // Deployment function
   const handleDeploy = async () => {
    try {
      setStatus('Preparing deployment...');

      const symbol = `apt-${tokenName.toLowerCase()}`;
      const clarityCode = contractTemplate
        .replace(/<<TOKEN_NAME>>/g, tokenName)
        .replace(/<<SYMBOL>>/g, symbol)
        .replace(/<<valuation>>/g, supply);

      setStatus('Deploying contract...');
      
       const response = await request('stx_deployContract', {
        contractName: tokenName,
        codeBody: clarityCode,
        clarityVersion: '3',
        network: "testnet"
      });

      
      setSymbol('');
      setSupply('');
      setStatus(`Success! Contract deployed. TXID: ${result.txid}`);
      
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      console.error('Deployment error:', err);
    }
  };

}