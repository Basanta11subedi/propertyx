
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
(define-constant err-owner-only (err u105))
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


(define-read-only (get-contract-owner)
  (begin 
  (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
  (ok true))
)