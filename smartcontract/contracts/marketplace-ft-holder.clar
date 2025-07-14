
;; title: marketplace-ft-holder
;; version:
;; summary:
;; description:

;; traits
;;
(use-trait nft-trait 'STM6S3AESTK9NAYE3Z7RS00T11ER8JJCDNTKG711.nft-trait.nft-trait)
(use-trait ft-trait  'STM6S3AESTK9NAYE3Z7RS00T11ER8JJCDNTKG711.sip-010-trait.sip-010-trait)

;; token definitions
;;

;; constants
;;

;;error
(define-constant ERR-NO-AUTH (err 100))
(define-constant ERR-TRANSFER-FT-FAILED (err 101))
(define-constant ERR-CONTRACT-DEACTIVATED (err 102))

;;data



;; data vars
;;
(define-data-var admin principal tx-sender)
(define-data-var contract-active bool true)

;; data maps
;;

;; public functions
;;
(define-public (transfer-ft (contract-principle <ft-trait>) (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin 
    (asserts! (is-eq (var-get admin) tx-sender) ERR-NO-AUTH)
    (asserts! (is-eq (var-get contract-active) true) ERR-CONTRACT-DEACTIVATED)
    (unwrap! (contract-call? contract-principle transfer amount (as-contract tx-sender) recipient memo) ERR-TRANSFER-FT-FAILED)
    (ok true)
  )
  
)

(define-public (transfer-nft (contract-principle <nft-trait>) (amount uint) (sender principal) (recipient principal))
  (begin 
    (asserts! (is-eq (var-get admin) tx-sender) ERR-NO-AUTH)
    (asserts! (is-eq (var-get contract-active) true) ERR-CONTRACT-DEACTIVATED)
    (unwrap! (contract-call? contract-principle transfer amount (as-contract tx-sender) recipient) ERR-TRANSFER-FT-FAILED)
    (ok true)
  )
  
)

;; read only functions
;;

;; private functions
;;

