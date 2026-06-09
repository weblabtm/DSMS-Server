# OTP Generation and Validation Guide

This document describes the design, implementation, endpoints, and testing flows for the DSMS One-Time Password (OTP) verification and Multi-Factor Authentication (MFA) transaction system.

---

## Architecture & Flow (Pattern A - Short-Lived MFA Token)

To protect credentials and prevent brute-force or session fixation attacks, DSMS utilizes a short-lived **MFA Transaction Token** stored in **Redis** with an automatic TTL of 5 minutes.

```
       Client                  Server (Auth Controller)          MfaTransactionStore (Redis)
         |                                |                                  |
         |----- 1. POST /auth/login ----->|                                  |
         |      (email, password)         |-- Check credentials              |
         |                                |-- User has phone (needs OTP)     |
         |                                |                                  |
         |                                |--- 2. createTransaction() ------>| (Save userId & rememberMe)
         |<-- 3. Return 400 OTP Required -|                                  | (Expires in 5 minutes)
         |    (mfaToken, maskedPhone)     |                                  |
         |                                |                                  |
         |----- 4. POST /otp/generate --->|                                  |
         |      (email, mfaToken)         |-- Lookup user's raw phone        |
         |                                |-- Send SMS / Console log         |
         |                                |                                  |
         |----- 5. POST /otp/validate --->|                                  |
         |      (otp, mfaToken)           |--- 6. markVerified(mfaToken) --->| (Mark verified: true)
         |<---- 200 OK (Verified) --------|                                  |
         |                                |                                  |
         |----- 7. POST /auth/login ----->|                                  |
         |      (email, password,         |-- Validate credentials           |
         |       mfaToken)                |--- 8. isVerified(mfaToken) ----->| (Check verification state)
         |                                |--- 9. deleteTransaction() ------>| (Destroy transaction)
         |<---- 200 OK (Session Issued) --|                                  |
```

### Key Security Decisions
1. **No Client Password Caching**: Plaintext user passwords are submitted, verified, and immediately discarded by the client. The client never stores credentials in persistent cookies or LocalStorage.
2. **In-Memory Cache (Redis)**: Transient validation states and verification codes are kept exclusively in Redis with standard 5-minute TTL expirations. Active transaction codes are never saved to the SQL database, preventing database index bloat and leak risk.
3. **One-Time Destruction**: The MFA transaction is deleted from Redis immediately upon a successful login completion, preventing replay attacks.
4. **Rate Limiting & CAPTCHA**: `/auth/otp/generate` is protected by a rate limiter allowing a maximum of **5 requests per 10 minutes** per IP and google reCAPTCHA verification.

---

## HTTP API Endpoints

### 1. Login Authentication
* **URL**: `/auth/login`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "identifier": "user@email.com",
    "password": "mySecurePassword",
    "rememberMe": true,
    "mfaToken": "d748f219-c09a-4c28-971a-68a865f375a0"
  }
  ```
  *(mfaToken is omitted on the first login request)*
* **Responses**:
  - **MFA Required (400 Bad Request)**:
    ```json
    {
      "message": "OTP required",
      "mfaToken": "d748f219-c09a-4c28-971a-68a865f375a0",
      "phoneNumber": "+94xxxxxxx678"
    }
    ```
  - **Login Complete (200 OK)**:
    Returns the standard `AuthSessionResponse` with JWT token payload and sets the secure session cookie.

### 2. Generate OTP
* **URL**: `/auth/otp/generate`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "email": "user@email.com",
    "phoneNumber": "+94xxxxxxx678",
    "captchaToken": "g-recaptcha-response-token"
  }
  ```
  *(The server will look up the real phone number by email if the phoneNumber passed is masked or empty)*
* **Response**: Sets `otp_token` cookie and returns:
  ```json
  {
    "token": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
  }
  ```

### 3. Validate OTP
* **URL**: `/auth/otp/validate`
* **Method**: `POST`
* **Body**:
  ```json
  {
    "otp": "123456",
    "mfaToken": "d748f219-c09a-4c28-971a-68a865f375a0"
  }
  ```
* **Response**: Marks `mfaToken` as verified in Redis, clears the `otp_token` cookie, and returns:
  ```json
  {
    "message": "OTP verified successfully."
  }
  ```

---

## Local Testing with the CLI Script

You can test the generation and verification flows locally using the custom CLI script:
```bash
npx tsx scripts/test-otp.ts --email "superadmin@email.com"
```
Or run it interactively:
```bash
npx tsx scripts/test-otp.ts
```
To test MFA login flows, use Postman, curl, or standard web browser interactions on the local frontend application (`http://localhost:5173`).
