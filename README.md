# Trimm | Premium URL Shortener & Analytics

Trimm is a high-fidelity, end-to-end full-stack URL shortener and analytics platform designed to demonstrate modern web engineering patterns, security practices, and professional UI/UX design.

This application is built with a backend in **Node.js + Express**, a lightweight and performant relational storage engine in **SQLite**, and a premium single-page application (SPA) client in **Vanilla HTML, CSS, and JS**.

---

## 🌟 Features

*   **Secure Authentication:** User signup and login with cryptographically hashed passwords using `bcrypt` and stateless session management via JSON Web Tokens (`JWT`).
*   **Custom Slugs/Aliases:** Users can generate randomized short codes (6 alphanumeric characters) or input custom slugs (e.g. `trimm/portfolio`) with real-time uniqueness validation.
*   **Detailed Analytics Tracking:** Records total click counts, referral traffic sources, browser distributions, and device categorization dynamically on redirect.
*   **Dynamic Visualizations:** Generates rich line-charts of click history over the last 7 days and breakdown gauges using `Chart.js`.
*   **QR Code Generation:** Real-time generation of QR codes for easy sharing, with dynamic canvas/blob downloading.
*   **Premium Glassmorphic UI:** A dark-themed layout featuring card-based components, glowing micro-animations, full mobile responsiveness, and dynamic validation states.
*   **Fast Redirect Action:** Performs standard `HTTP 301 Permanent Redirect` directly in database operations under 10ms.

---

## 🛠️ Technical Stack & Architecture

### High-Level Flow
1. **Frontend (SPA):** Static assets are loaded in the browser. Toggles UI states (Auth ↔ Dashboard ↔ Analytics) client-side. Sends REST requests to API using fetch with header `Authorization: Bearer <token>`.
2. **REST API Server:** Express parses incoming JSON and authorizes routes with token-validation middleware.
3. **Database (SQLite):** Serves SQL transactions with foreign-key constraints on user, link, and click records.

```
+--------------------------------------------------------+
|                      Web Browser                       |
|  (Vanilla HTML5 / CSS3 Grid / ES6 Core / Chart.js)     |
+---------------------------+----------------------------+
                            |
                     HTTPS / REST API
                            |
+---------------------------v----------------------------+
|                  Express.js Web Server                 |
|      (JWT Verification / Bcrypt / User-Agent Parse)     |
+---------------------------+----------------------------+
                            |
                        SQL Query
                            |
+---------------------------v----------------------------+
|                     SQLite Database                    |
|        (users / links / visits Relational Schema)      |
+--------------------------------------------------------+
```

---

## 🗄️ Relational Database Schema

The database uses SQLite, which requires zero-install overhead but maintains full SQL transaction safety.

### Entity Relationship Model

```
+------------------+          +------------------+          +------------------+
|      users       |          |      links       |          |      visits      |
+------------------+          +------------------+          +------------------+
| id [PK] (TEXT)   |<----+    | id [PK] (TEXT)   |<----+    | id [PK] (TEXT)   |
| email (TEXT)     |     |    | short_code (TEXT)|     |    | visited_at (TEXT)|
| password_hash    |     +---o| owner_id [FK]    |     |    | referrer (TEXT)  |
| created_at (TEXT)|          | long_url (TEXT)  |     +---o| link_id [FK]     |
+------------------+          | created_at (TEXT)|          | browser (TEXT)   |
                              | click_count (INT)|          | device (TEXT)    |
                              +------------------+          | user_agent (TEXT)|
                                                            | ip_address (TEXT)|
                                                            +------------------+
```

*   **Users to Links:** One-to-Many relationship (a user owns zero or more links).
*   **Links to Visits:** One-to-Many relationship (each visit is logged against a single short link).

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v16+) and **npm** installed on your system.

### 2. Installation
Clone or locate the project directory:
```bash
cd C:\Users\farha_ddw9b3s\.gemini\antigravity-ide\scratch\url-shortener
npm install
```

### 3. Run the Server
Start the development server:
```bash
npm start
```
The server will bind to port **3000** by default and initialize `database.sqlite` in the root folder.
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Integration Tests
Verify endpoint correctness and database updates:
```bash
node test-endpoints.js
```

---

## 🔌 API Documentation

| Route | Method | Access | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/signup` | POST | Public | Create new user account |
| `/api/v1/login` | POST | Public | Validate credentials and return JWT |
| `/api/v1/links` | GET | Protected | Retrieve all short links owned by active user |
| `/api/v1/links` | POST | Protected | Create shortened URL (accepts `longUrl`, `customCode`) |
| `/api/v1/links/:id` | PATCH | Protected | Edit link short-slug (accepts `shortCode`) |
| `/api/v1/links/:id` | DELETE | Protected | Remove short link and all related click history |
| `/api/v1/links/:id/analytics` | GET | Protected | Fetch detailed visit history and visual breakdown |
| `/r/:shortCode` | GET | Public | Public redirect path; logs visit metadata and returns HTTP 301 |

---

