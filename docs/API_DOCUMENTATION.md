# DSMS Server API Documentation

Welcome to the Driving School Management System (DSMS) Server API documentation. This document describes all available HTTP endpoints, payload formats, security constraints, and response structures.

---

## Table of Contents

1. [Global Concepts](#global-concepts)
   - [Base URL](#base-url)
   - [Authentication & Access Control](#authentication--access-control)
   - [Tenant Scope & Resolution](#tenant-scope--resolution)
2. [System Module](#1-system-module)
   - [GET /](#get-)
   - [GET /config](#get-config)
   - [GET /health](#get-health)
3. [Authentication Module](#2-authentication-module)
   - [POST /auth/register](#post-authregister)
   - [POST /auth/login](#post-authlogin)
   - [POST /auth/refresh](#post-authrefresh)
   - [POST /auth/logout](#post-authlogout)
   - [GET /auth/unlock](#get-authunlock)
   - [POST /auth/otp/generate](#post-authotpgenerate)
   - [POST /auth/otp/validate](#post-authotpvalidate)
4. [Tenant Module](#3-tenant-module)
   - [POST /tenant](#post-tenant)
   - [GET /tenant](#get-tenant)
   - [GET /tenant/:id](#get-tenantid)
   - [PATCH /tenant/:id](#patch-tenantid)
   - [GET /tenant/slug/:slug](#get-tenantslugslug)
   - [GET /tenant/slug/:slug/availability](#get-tenantslugslugavailability)

---

## Global Concepts

### Base URL
By default, the server runs locally at:
```
http://localhost:3000
```
In multi-tenant setups, the base URL varies dynamically according to the tenant slug (e.g., `http://acme.localhost:3000`).

### Authentication & Access Control
The DSMS API uses **JSON Web Token (JWT) Bearer Authentication**.
* Authenticated endpoints require the following header:
  ```http
  Authorization: Bearer <Access_Token>
  ```
* Permissions are scope-aware and checked at the database/session level:
  * **Super Admin**: Bypasses all RBAC rules and checks.
  * **Tenant Admin / Branch Manager / Instructor / Front Desk / Student**: Validated against their default role permission matrix and limited to their resource scope (global, tenant-level, branch-level, or own-resource).

### Tenant Scope & Resolution
Tenants are isolated databases/spaces identified by a unique **Slug**.
* **Wildcard Subdomain Routing**: The host header is parsed to resolve the tenant slug dynamically (e.g. `acme.example.test` resolves the tenant as `acme`).
* **Header Fallback**: Callers can manually specify the tenant slug using the custom header:
  ```http
  x-tenant-id: <tenant_slug>
  ```
* **Mismatch Safeguard**: If an authenticated user's token belongs to `tenant-A`, but they request a resource from `tenant-B` (via Host subdomain or header), the server rejects the request with `403 Forbidden` ("Tenant mismatch").

---

## 1. System Module

### GET /
Displays the server status and connection state.

* **URL Path**: `/`
* **HTTP Method**: `GET`
* **Authorization**: Public (No Auth Required)
* **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "message": "Server is live"
  }
  ```

---

### GET /config
Returns the API base URL and runtime hostname derived from the request.

* **URL Path**: `/config`
* **HTTP Method**: `GET`
* **Authorization**: Public (No Auth Required)
* **Response `200 OK`**:
  ```json
  {
    "apiBaseUrl": "http://localhost:3000",
    "hostname": "localhost"
  }
  ```

---

### GET /health
Monitors database and cache connectivity.

* **URL Path**: `/health`
* **HTTP Method**: `GET`
* **Authorization**: Public (No Auth Required)
* **Response `200 OK` (All services connected)**:
  ```json
  {
    "status": "ok",
    "message": "Server is running",
    "dependencies": {
      "postgresql": {
        "status": "connected"
      },
      "redis": {
        "status": "connected"
      }
    }
  }
  ```
* **Response `503 Service Unavailable` (Dependency disconnected)**:
  ```json
  {
    "status": "error",
    "message": "One or more dependencies are unavailable",
    "dependencies": {
      "postgresql": {
        "status": "disconnected",
        "error": "Connection timed out"
      },
      "redis": {
        "status": "connected"
      }
    }
  }
  ```

---

## 2. Authentication Module

### POST /auth/register
Registers a new user account on the platform.

* **URL Path**: `/auth/register`
* **HTTP Method**: `POST`
* **Authorization**: 
  * **Public**: Allowed only when self-registering as a `Tenant Admin` (`role: "Tenant Admin"`).
  * **Authenticated**: Required for all other roles. The inviter must have the authority to create users with the requested role.
* **Request Body** (`application/json`):
  ```json
  {
    "identifier": "admin@acme.com",
    "password": "StrongPassword123!",
    "role": "Tenant Admin",
    "tenantId": "acme",
    "branchId": "branch-01"
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f9g1h2...",
    "user": {
      "id": "user-uuid-123",
      "identifier": "admin@acme.com",
      "roles": ["Tenant Admin"],
      "tenantId": "acme",
      "branchId": "branch-01"
    }
  }
  ```
* **Response `400 Bad Request`**: Missing required parameters or invalid formatting.
* **Response `403 Forbidden`**: Role registration policy violation (e.g. attempting to self-register as a role other than `Tenant Admin`, or inviter lacks permissions).

---

### POST /auth/login
Authenticates a user and starts a session.

* **URL Path**: `/auth/login`
* **HTTP Method**: `POST`
* **Authorization**: Public
* **Request Body** (`application/json`):
  ```json
  {
    "identifier": "admin@acme.com",
    "password": "StrongPassword123!",
    "tenantId": "acme",
    "branchId": "branch-01",
    "captchaToken": "optional-recaptcha-v2-or-v3-token"
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f9g1h2...",
    "user": {
      "id": "user-uuid-123",
      "identifier": "admin@acme.com",
      "roles": ["Tenant Admin"],
      "tenantId": "acme",
      "branchId": "branch-01"
    }
  }
  ```
* **Response `401 Unauthorized`**: Invalid username/identifier or password.
* **Response `403 Forbidden`**: Account is locked due to too many failed attempts.
* **Response `429 Too Many Requests`**: IP is rate-limited.

---

### POST /auth/refresh
Exchanges a valid refresh token for a new access token.

* **URL Path**: `/auth/refresh`
* **HTTP Method**: `POST`
* **Authorization**: Public
* **Request Body** (`application/json`):
  ```json
  {
    "refreshToken": "d8f9g1h2..."
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d8f9g1h2..."
  }
  ```
* **Response `401 Unauthorized`**: Refresh token is expired, blacklisted, or invalid.

---

### POST /auth/logout
Revokes the session and blacklists the refresh token.

* **URL Path**: `/auth/logout`
* **HTTP Method**: `POST`
* **Authorization**: Public
* **Request Body** (`application/json`):
  ```json
  {
    "refreshToken": "d8f9g1h2..."
  }
  ```
* **Response `204 No Content`**: Revocation completed.

---

### GET /auth/unlock
Unlocks an account that was locked due to brute-force protection.

* **URL Path**: `/auth/unlock`
* **HTTP Method**: `GET`
* **Authorization**: Public (Unlocking is typically done via a link sent to the user's email)
* **Query Parameters**:
  * `token` (required string): The unlock token sent to the user's email.
* **Response `200 OK`**:
  ```json
  {
    "message": "Account successfully unlocked. You can now log in."
  }
  ```
* **Response `400 Bad Request`**: Token is missing, expired, or invalid.

---

### POST /auth/otp/generate
Generates a secure 6-digit verification OTP and dispatches it.

* **URL Path**: `/auth/otp/generate`
* **HTTP Method**: `POST`
* **Authorization**: Public
* **Rate Limit**: Strictly limited to **5 requests per 10 minutes** per IP.
* **Request Headers**:
  * `Cookie`: May receive session cookies.
  * `x-tenant-id` (optional): Tenant boundary filter.
  * `x-branch-id` (optional): Branch boundary filter.
* **Request Body** (`application/json`):
  * *Note: At least one of `email` or `phoneNumber` must be provided.*
  ```json
  {
    "email": "user@acme.com",
    "phoneNumber": "+94727722924",
    "captchaToken": "recaptcha-bypass-token"
  }
  ```
* **Response `200 OK`**:
  * Sets an HttpOnly cookie: `otp_token` containing the verification hash payload (expires in 5 minutes).
  ```json
  {
    "message": "OTP generated successfully.",
    "token": "otp_transaction_token_string"
  }
  ```
* **Response `400 Bad Request`**: Invalid inputs or failed CAPTCHA verification.

---

### POST /auth/otp/validate
Validates the 6-digit OTP code against the transaction token.

* **URL Path**: `/auth/otp/validate`
* **HTTP Method**: `POST`
* **Authorization**: Public
* **Request Headers**:
  * `Cookie`: Includes `otp_token=<token>` set during generation.
* **Request Body** (`application/json`):
  ```json
  {
    "otp": "123456",
    "token": "otp_transaction_token_string"
  }
  ```
  *(Note: `token` is optional in the request body and serves as a fallback if the HttpOnly `otp_token` cookie is missing).*
* **Response `200 OK`**:
  * Clears the `otp_token` cookie immediately.
  ```json
  {
    "message": "OTP verified successfully."
  }
  ```
* **Response `400 Bad Request`**: Token is missing, expired, or the OTP code is incorrect.

---

## 3. Tenant Module

### POST /tenant
Registers a new tenant boundary and links it to an administrative user.

* **URL Path**: `/tenant`
* **HTTP Method**: `POST`
* **Authorization**: Authenticated. Requires permission `tenant.manage` (held by `Super Admin` and `Tenant Admin`).
* **Request Body** (`application/json`):
  ```json
  {
    "name": "Acme Academy",
    "slug": "acme",
    "tenantAdminIdentifier": "admin@acme.com"
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "id": "tenant-uuid-456",
    "name": "Acme Academy",
    "slug": "acme",
    "isActive": true,
    "createdAt": "2026-06-06T12:00:00.000Z",
    "updatedAt": "2026-06-06T12:00:00.000Z"
  }
  ```
* **Response `400 Bad Request`**: Missing required fields or duplicate slug.
* **Response `403 Forbidden`**: Missing required permission `tenant.manage`.

---

### GET /tenant
Lists all tenants registered on the platform.

* **URL Path**: `/tenant`
* **HTTP Method**: `GET`
* **Authorization**: Authenticated. Requires `Super Admin` role.
* **Response `200 OK`**:
  ```json
  [
    {
      "id": "tenant-uuid-456",
      "name": "Acme Academy",
      "slug": "acme",
      "isActive": true
    }
  ]
  ```
* **Response `403 Forbidden`**: Only Super Admins can list all tenants.

---

### GET /tenant/:id
Fetches details of a specific tenant by UUID.

* **URL Path**: `/tenant/:id`
* **HTTP Method**: `GET`
* **Authorization**: Authenticated. Requires permission `tenant.manage` (Must be a `Super Admin`, or the `Tenant Admin` belonging to this tenant).
* **Response `200 OK`**:
  ```json
  {
    "id": "tenant-uuid-456",
    "name": "Acme Academy",
    "slug": "acme",
    "isActive": true
  }
  ```
* **Response `404 Not Found`**: Tenant does not exist.

---

### PATCH /tenant/:id
Updates tenant details (supports renaming and deactivating/activating).

* **URL Path**: `/tenant/:id`
* **HTTP Method**: `PATCH`
* **Authorization**: Authenticated. Requires permission `tenant.manage` (Must be a `Super Admin`, or the `Tenant Admin` belonging to this tenant).
* **Request Body** (`application/json`):
  ```json
  {
    "name": "Acme Academy LLC",
    "isActive": false
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "id": "tenant-uuid-456",
    "name": "Acme Academy LLC",
    "slug": "acme",
    "isActive": false
  }
  ```
* **Response `404 Not Found`**: Tenant does not exist.

---

### GET /tenant/slug/:slug
Fetches tenant details using their unique subdomain slug identifier.

* **URL Path**: `/tenant/slug/:slug`
* **HTTP Method**: `GET`
* **Authorization**: Authenticated. Requires permission `tenant.manage` (Must be a `Super Admin`, or the `Tenant Admin` belonging to this tenant).
* **Response `200 OK`**:
  ```json
  {
    "id": "tenant-uuid-456",
    "name": "Acme Academy",
    "slug": "acme",
    "isActive": true
  }
  ```
* **Response `404 Not Found`**: Tenant does not exist.

---

### GET /tenant/slug/:slug/availability
Checks if a tenant slug is available for registration.

* **URL Path**: `/tenant/slug/:slug/availability`
* **HTTP Method**: `GET`
* **Authorization**: Public (Allows guest registration views to validate before submission)
* **Response `200 OK` (Available)**:
  ```json
  true
  ```
* **Response `200 OK` (Taken)**:
  ```json
  false
  ```
