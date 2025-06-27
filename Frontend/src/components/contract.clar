;; title: APT-Token
;; version: 1
(impl-trait 'ST1VZ3YGJKKC8JSSWMS4EZDXXJM7QWRBEZ0ZWM64E.real-world-asset-trait.real-world-asset-trait)

(define-fungible-token <<TOKEN_NAME>>)

(define-data-var name (string-ascii 32) "<<TOKEN_NAME>>")
(define-data-var symbol (string-ascii 32) "apt-<<TOKEN_NAME>>")
(define-data-var total-supply uint u0)
(define-data-var owner principal tx-sender)
(define-constant decimals u6)

(define-constant err-unauthorized (err u101))
(define-constant err-invalid-amount (err u102))

(define-public (tokenize-asset (valuation uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) err-unauthorized)
    (asserts! (is-eq (var-get total-supply) u0) err-unauthorized)
    (ft-mint? <<TOKEN_NAME>> tx-sender valuation)
    (var-set total-supply valuation)
    (ok true)
  )
)