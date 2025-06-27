;; Title: PXT/STX Liquidity Pool
;; Traits: Implement SIP-010 (fungible token) for LP tokens

(define-constant PXT-contract 'ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.pxttest1)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-insufficient-liquidity (err u102))
(define-constant err-zero-amount (err u103))
(define-constant err-slippage-too-high (err u104))
(define-constant err-deadline-expired (err u105))
(define-constant err-invalid-token (err u106))
(define-constant err-not-authorized (err u107))

;; Fee is 0.3% (30 basis points) - industry standard
(define-constant fee-numerator u3)
(define-constant fee-denominator u1000)

;; Define fungible tokens for LP tokens
(define-fungible-token stx-pxt-lp)

;; Define data variables
(define-data-var total-stx uint u0)
(define-data-var total-pxt uint u0)
(define-data-var last-price-cumulative uint u0)
(define-data-var last-block-height uint u0)

;; Helper functions for math calculations

;; Calculate the amount of tokens to be received in a swap
(define-read-only (get-amount-out (amount-in uint) (reserve-in uint) (reserve-out uint))
  (let
    (
      (amount-in-with-fee (* amount-in (- fee-denominator fee-numerator)))
      (numerator (* amount-in-with-fee reserve-out))
      (denominator (+ (* reserve-in fee-denominator) amount-in-with-fee))
    )
    (/ numerator denominator)
  )
)

;; Calculate the amount of tokens needed to be sent for desired output
(define-read-only (get-amount-in (amount-out uint) (reserve-in uint) (reserve-out uint))
  (let
    (
      (numerator (* reserve-in amount-out fee-denominator))
      (denominator (* (- reserve-out amount-out) (- fee-denominator fee-numerator)))
    )
    (+ (/ numerator denominator) u1)
  )
)



;; Calculate the minimum of two numbers
(define-read-only (min (a uint) (b uint))
  (if (<= a b) a b)
)

;; Get current reserves
(define-read-only (get-reserves)
  (ok {
    stx-reserve: (var-get total-stx),
    pxt-reserve: (var-get total-pxt)
  })
)

;; Get LP token total supply
(define-read-only (get-lp-token-supply)
  (ok (ft-get-supply stx-pxt-lp))
)

;; Get user's LP token balance
(define-read-only (get-lp-balance (user principal))
  (ok (ft-get-balance stx-pxt-lp user))
)

(define-public (add-liquidity 
  (stx-amount uint) 
  (pxt-amount uint) 
  (min-stx-amount uint) 
  (min-pxt-amount uint)
  (deadline uint)
  (recipient principal)
)
  (let (
    (stx-reserve (var-get total-stx))
    (pxt-reserve (var-get total-pxt))
    (total-liquidity (ft-get-supply stx-pxt-lp))
  )
  (begin
    ;; Check deadline expiration
    (asserts! (<= stacks-block-height deadline) err-deadline-expired)
    
    ;; Validate input amounts
    (asserts! (and (> stx-amount u0) (> pxt-amount u0)) err-zero-amount)
    
    (if (is-eq total-liquidity u0)
      ;; Initial liquidity provision
      (let (
        (liquidity-minted (sqrti (* stx-amount pxt-amount)))
      )
      (begin
        ;; Verify minimum amounts for initial deposit
        (asserts! (and (>= stx-amount min-stx-amount) 
                      (>= pxt-amount min-pxt-amount)) 
                  err-slippage-too-high)
        
        ;; Update reserves
        (var-set total-stx stx-amount)
        (var-set total-pxt pxt-amount)
        
        ;; Mint LP tokens
        (try! (ft-mint? stx-pxt-lp liquidity-minted recipient))
        
        ;; Return success with liquidity details
        (ok { 
          liquidity-minted: liquidity-minted, 
          stx-amount: stx-amount, 
          pxt-amount: pxt-amount 
        })
      ))
      ;; Subsequent liquidity additions
      (let (
        (stx-optimal (/ (* pxt-amount stx-reserve) pxt-reserve))
        (pxt-optimal (/ (* stx-amount pxt-reserve) stx-reserve))
        (liquidity-minted 
          (if (<= stx-optimal stx-amount)
            (/ (* stx-optimal total-liquidity) stx-reserve)
            (/ (* pxt-optimal total-liquidity) pxt-reserve)
          )
        )
      )
      (begin
        ;; Verify minimum amounts based on optimal ratio
        (asserts! 
          (if (<= stx-optimal stx-amount)
            (>= stx-optimal min-stx-amount)
            (>= pxt-optimal min-pxt-amount)
          )
          err-slippage-too-high
        )
        
        ;; Update reserves
        (var-set total-stx 
          (if (<= stx-optimal stx-amount)
            (+ stx-reserve stx-optimal)
            (+ stx-reserve stx-amount)
          )
        )
        (var-set total-pxt 
          (if (<= stx-optimal stx-amount)
            (+ pxt-reserve pxt-amount)
            (+ pxt-reserve pxt-optimal)
          )
        )
        
        ;; Transfer tokens from user
        (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
        (try! (contract-call? PXT-contract transfer pxt-amount tx-sender (as-contract tx-sender) none))
        
        ;; Mint LP tokens
        (try! (ft-mint? stx-pxt-lp liquidity-minted recipient))
        
        ;; Update price tracking
        (var-set last-block-height stacks-block-height)
        
        (ok { 
          liquidity-minted: liquidity-minted,
          stx-amount: (if (<= stx-optimal stx-amount) stx-optimal stx-amount),
          pxt-amount: (if (<= stx-optimal stx-amount) pxt-amount pxt-optimal)
        })
      ))
    )
  )
))

;; Remove liquidity from the pool
(define-public (remove-liquidity
  (liquidity uint)
  (min-stx-amount uint)
  (min-pxt-amount uint)
  (deadline uint)
  (recipient principal)
)
  (let
    (
      (stx-reserve (var-get total-stx))
      (pxt-reserve (var-get total-pxt))
      (total-liquidity (ft-get-supply stx-pxt-lp))
      (stx-amount (/ (* liquidity stx-reserve) total-liquidity))
      (pxt-amount (/ (* liquidity pxt-reserve) total-liquidity))
    )
    
    ;; Check deadline
    (asserts! (<= stacks-block-height deadline) err-deadline-expired)
    
    ;; Check liquidity > 0
    (asserts! (> liquidity u0) err-zero-amount)
    
    ;; Check slippage tolerance
    (asserts! (and (>= stx-amount min-stx-amount) (>= pxt-amount min-pxt-amount)) err-slippage-too-high)
    
    ;; Burn LP tokens
    (try! (ft-burn? stx-pxt-lp liquidity tx-sender))
    
    ;; Update reserves
    (var-set total-stx (- stx-reserve stx-amount))
    (var-set total-pxt (- pxt-reserve pxt-amount))
    
    ;; Transfer tokens to recipient
    (try! (as-contract (stx-transfer? stx-amount tx-sender recipient)))
    (try! (as-contract (contract-call? PXT-contract transfer pxt-amount tx-sender recipient none)))
    
    ;; Update last price info
    (var-set last-block-height stacks-block-height)
    
    (ok {
      stx-amount: stx-amount,
      pxt-amount: pxt-amount,
      liquidity-burned: liquidity
    })
  )
)

;; Swap STX for pxt
(define-public (swap-stx-for-pxt
  (stx-amount uint)
  (min-pxt-out uint)
  (deadline uint)
  (recipient principal)
)
  (let
    (
      (stx-reserve (var-get total-stx))
      (pxt-reserve (var-get total-pxt))
      (pxt-amount (get-amount-out stx-amount stx-reserve pxt-reserve))
    )
    
    ;; Check deadline
    (asserts! (<= stacks-block-height deadline) err-deadline-expired)
    
    ;; Check amount > 0
    (asserts! (> stx-amount u0) err-zero-amount)
    
    ;; Check slippage tolerance
    (asserts! (>= pxt-amount min-pxt-out) err-slippage-too-high)
    
    ;; Update reserves
    (var-set total-stx (+ stx-reserve stx-amount))
    (var-set total-pxt (- pxt-reserve pxt-amount))
    
    ;; Transfer tokens
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
    (try! (as-contract (contract-call? PXT-contract transfer pxt-amount tx-sender recipient none)))
    
    ;; Update price accumulator
    (var-set last-block-height stacks-block-height)
    
    (ok { pxt-amount: pxt-amount })
  )
)

;; Swap pxt for STX
(define-public (swap-pxt-for-stx
  (pxt-amount uint)
  (min-stx-out uint)
  (deadline uint)
  (recipient principal)
)
  (let
    (
      (stx-reserve (var-get total-stx))
      (pxt-reserve (var-get total-pxt))
      (stx-amount (get-amount-out pxt-amount pxt-reserve stx-reserve))
    )
    
    ;; Check deadline
    (asserts! (<= stacks-block-height deadline) err-deadline-expired)
    
    ;; Check amount > 0
    (asserts! (> pxt-amount u0) err-zero-amount)
    
    ;; Check slippage tolerance
    (asserts! (>= stx-amount min-stx-out) err-slippage-too-high)
    
    ;; Update reserves
    (var-set total-stx (- stx-reserve stx-amount))
    (var-set total-pxt (+ pxt-reserve pxt-amount))
    
    ;; Transfer tokens
    (try! (contract-call? PXT-contract transfer pxt-amount tx-sender (as-contract tx-sender) none))
    (try! (as-contract (stx-transfer? stx-amount tx-sender recipient)))
    
    ;; Update price accumulator
    (var-set last-block-height stacks-block-height)
    
    (ok { stx-amount: stx-amount })
  )
)

;; Initialize the pool
(define-public (initialize-pool)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set last-block-height stacks-block-height)
    (ok true)
  )
)

;; tHIS BELOW code is for the seurity of the pool which i will see after i finished other code.

;; ;; Title: Enhanced pxt/STX Liquidity Pool
;; ;; Traits: Implement SIP-010 (fungible token) for LP tokens with added security features

;; (define-constant PXT-contract 'ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.pxttest1)

;; (define-constant contract-owner tx-sender)
;; (define-constant err-owner-only (err u100))
;; (define-constant err-insufficient-balance (err u101))
;; (define-constant err-insufficient-liquidity (err u102))
;; (define-constant err-zero-amount (err u103))
;; (define-constant err-slippage-too-high (err u104))
;; (define-constant err-deadline-expired (err u105))
;; (define-constant err-invalid-token (err u106))
;; (define-constant err-not-authorized (err u107))
;; (define-constant err-pool-locked (err u108))
;; (define-constant err-frontrun-protected (err u109))

;; ;; Fee is 0.3% (30 basis points) - industry standard
;; (define-constant fee-numerator u3)
;; (define-constant fee-denominator u1000)

;; ;; Define fungible tokens for LP tokens
;; (define-fungible-token stx-pxt-lp)

;; ;; Define data variables
;; (define-data-var total-stx uint u0)
;; (define-data-var total-pxt uint u0)
;; (define-data-var last-price-cumulative uint u0)
;; (define-data-var last-block-height uint u0)

;; ;; ===== NEW SECURITY FEATURES =====


;; ;; 3. Upgradeability - Proxy pattern components
;; (define-data-var implementation-version uint u1)
;; (define-data-var upgrade-locked bool false)

;; ;; 4. Emergency functions
;; (define-data-var pool-locked bool false)
;; (define-data-var emergency-admin (optional principal) none)

;; ;; 6. Front-running protection
;; (define-data-var min-swap-amount uint u1000) ;; Minimum 1000 microSTX to prevent spam
;; (define-data-var max-price-impact uint u500) ;; Max 5% price impact per trade (500 = 5% in basis points)
;; ;; ================================

;; ;; [Previous helper functions remain the same: get-amount-out, get-amount-in, min, get-reserves, get-lp-token-supply, get-lp-balance]

;; ;; ===== NEW FUNCTION IMPLEMENTATIONS =====



;; ;; 3. Upgradeability Functions
;; (define-public (propose-upgrade (new-contract principal))
;;   (begin
;;     (asserts! (is-eq tx-sender contract-owner) err-owner-only)
;;     (asserts! (not (var-get upgrade-locked)) err-pool-locked)
;;     (var-set upgrade-locked true)
;;     (ok true)
;;   )
;; )

;; (define-public (complete-upgrade (new-version uint))
;;   (begin
;;     (asserts! (is-eq tx-sender contract-owner) err-owner-only)
;;     (asserts! (var-get upgrade-locked)) err-not-authorized)
;;     (var-set implementation-version new-version)
;;     (var-set upgrade-locked false)
;;     (ok true)
;;   )
;; )

;; ;; 4. Emergency Functions
;; (define-public (set-emergency-admin (admin principal))
;;   (begin
;;     (asserts! (is-eq tx-sender contract-owner) err-owner-only)
;;     (var-set emergency-admin (some admin))
;;     (ok true)
;;   )
;; )

;; (define-public (lock-pool))
;;   (begin
;;     (asserts! (or 
;;               (is-eq tx-sender contract-owner)
;;               (is-eq tx-sender (unwrap-panic (var-get emergency-admin))))
;;               err-not-authorized)
;;     (var-set pool-locked true)
;;     (ok true)
;;   )
;; )

;; (define-public (unlock-pool))
;;   (begin
;;     (asserts! (is-eq tx-sender contract-owner) err-owner-only)
;;     (var-set pool-locked false)
;;     (ok true)
;;   )
;; )

;; ;; 6. Front-running Protection
;; (define-private (check-price-impact (amount-in uint) (reserve-in uint))
;;   (let (
;;     (price-impact (/ (* amount-in u10000) reserve-in)) ;; Calculate in basis points
;;     (asserts! (<= price-impact (var-get max-price-impact)) err-frontrun-protected)
;;   )
;; )

;; ;; ===== MODIFIED EXISTING FUNCTIONS WITH NEW PROTECTIONS =====

;; (define-public (add-liquidity 
;;   (stx-amount uint) 
;;   (pxt-amount uint) 
;;   (min-stx-amount uint) 
;;   (min-pxt-amount uint)
;;   (deadline uint)
;;   (recipient principal)
;; )
;;   (begin
;;     ;; Check if pool is locked
;;     (asserts! (not (var-get pool-locked)) err-pool-locked)
    
;;     ;; [Rest of original add-liquidity implementation]
    

;;   )
;; )

;; (define-public (swap-stx-for-pxt
;;   (stx-amount uint)
;;   (min-pxt-out uint)
;;   (deadline uint)
;;   (recipient principal)
;; )
;;   (let
;;     (
;;       (stx-reserve (var-get total-stx))
;;       (pxt-reserve (var-get total-pxt))
;;       (pxt-amount (get-amount-out stx-amount stx-reserve pxt-reserve))
;;     )
    
;;     ;; Front-running protection
;;     (asserts! (>= stx-amount (var-get min-swap-amount)) err-frontrun-protected)
;;     (check-price-impact stx-amount stx-reserve)
    
;;     ;; [Rest of original swap-stx-for-pxt implementation]

;;   )
;; )

;; (define-public (swap-pxt-for-stx
;;   (pxt-amount uint)
;;   (min-stx-out uint)
;;   (deadline uint)
;;   (recipient principal)
;; )
;;   (let
;;     (
;;       (stx-reserve (var-get total-stx))
;;       (pxt-reserve (var-get total-pxt))
;;       (stx-amount (get-amount-out pxt-amount pxt-reserve stx-reserve))
;;     )
    
;;     ;; Front-running protection
;;     (asserts! (>= pxt-amount (var-get min-swap-amount)) err-frontrun-protected)
;;     (check-price-impact pxt-amount pxt-reserve)
    
;;     ;; [Rest of original swap-pxt-for-stx implementation]
    

;;   )
;; )

;; ;; [Rest of original functions remain the same but should include pool-locked checks]