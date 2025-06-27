
;; title: Token
;; version:2
;; summary: This is the platform token for my website propertyX which tokenize hotels and real states


;; traits
(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)
;;

;; token definitions
(define-fungible-token propertyX u1000000000)
;;

;; constants
(define-constant err-insufficient-amount (err u100))
(define-constant not-token-owner (err u103))
(define-constant err-not-authorized (err u104))
(define-constant err-owner-only (err u105))



;; data vars
(define-data-var contract-owner principal tx-sender)
;;

;; data maps
(define-map admins principal bool)
(define-map locked-pxt principal uint)
;;

;; read only functions
(define-read-only (get-balance (who principal)) (ok (ft-get-balance propertyX who)))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-name) (ok "propertyX"))
(define-read-only (get-symbol) (ok "PXT"))
(define-read-only (get-token-uri) (ok none))
(define-read-only (get-total-supply) (ok (ft-get-supply propertyX)))
(define-read-only (is-admin (user principal)) (default-to false (map-get? admins user)))
(define-read-only (get-locked-pxt (who principal)) (ok (default-to u0 (map-get? locked-pxt who))))
;;


;; public functions
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin 
        (asserts! (is-eq tx-sender sender) not-token-owner)
        (asserts! (> amount u0) err-insufficient-amount)
        (try! (ft-transfer? propertyX amount sender recipient))
        (print { event-type: "Transfer", amount: amount, sender: sender, recipient: recipient })
        (match memo to-print (print to-print) 0x)
        (ok true)
    )
)

;; Function to mint the token 
(define-public (mint (amount uint) (recipient principal))
    (begin 
        (asserts! (or (is-eq tx-sender (var-get contract-owner)) (default-to false (map-get? admins tx-sender))) err-not-authorized)
        (asserts! (> amount u0) err-insufficient-amount)
        (try! (ft-mint? propertyX amount recipient))
        (print { event-type: "Mint", amount: amount, recipient: recipient})
        (ok true)
    )
)

;; User can burn their PXT token
(define-public (burn (amount uint))
    (begin 
        (asserts! (> amount u0) err-insufficient-amount)
        (try! (ft-burn? propertyX amount tx-sender))
        (print { event-type: "burn", amount: amount, recipient: tx-sender})
        (ok true)
    )
)

;; Owner can transfer ownership to other 
(define-public (transfer-ownership (new-owner principal))
    (begin 
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (var-set contract-owner new-owner)
        (ok true)
    )
)

;; contract owner can add admin
(define-public (add-admin (admin principal))
    (begin 
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (map-set admins admin true)
        (ok true)
    )
)

(define-public (remove-admin (admin principal))
    (begin 
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (map-delete admins admin)
        (ok true))
)

(define-public (lock-pxt (amount uint))
    (begin 
        (asserts! (> amount u0) err-insufficient-amount)
        (asserts! (<= amount (ft-get-balance propertyX tx-sender)) err-insufficient-amount)
        (try! (ft-transfer? propertyX amount tx-sender (as-contract tx-sender)))
        (let ((current-locked (default-to u0 (map-get? locked-pxt tx-sender))))
            (map-set locked-pxt tx-sender (+ current-locked amount)))
        
        (print { event-type: "LockPXT", amount: amount, user: tx-sender })
        (ok true)
    )
)

(define-public (unlock-pxt (amount uint))
    (begin 
        (asserts! (> amount u0) err-insufficient-amount)
        (let ((user-locked (default-to u0 (map-get? locked-pxt tx-sender))))
            (asserts! (<= amount user-locked) err-insufficient-amount)
            (try! (as-contract (ft-transfer? propertyX amount (as-contract tx-sender) tx-sender)))
            (map-set locked-pxt tx-sender (- user-locked amount)) 
            (print { event-type: "UnlockPXT", amount: amount, user: tx-sender })
            (ok true)
        )
    )
)

