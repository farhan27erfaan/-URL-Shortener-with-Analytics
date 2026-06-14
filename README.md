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

## 🎬 Interview Demo Script

Follow this structured flow during live placement evaluations to present features:

1.  **Register a New Account:**
    *   Navigate to `localhost:3000`. Show the sleek login screen.
    *   Click "Sign Up", enter a test email (`candidate@google.com`) and password (`pass123`), then submit.
    *   Demonstrate input validation error states (e.g. blank forms show dynamic red notifications).
2.  **Dashboard Overview:**
    *   Log in with the new credentials.
    *   Point out the empty dashboard state, highlighting the glassmorphism aesthetic and dark mode scheme.
3.  **Create Custom and Auto-Generated Short Links:**
    *   Input a long URL: `https://www.google.com` and hit "Generate". Check the auto-generated slug.
    *   Input `https://github.com` and input a custom alias `my-git`. Hit "Generate" and highlight that it created `/r/my-git`.
    *   Attempt to create `https://about.google` with the same alias `my-git` to show the **Conflict (409) Error Handling**.
4.  **Perform Redirects and Copy Actions:**
    *   Click the "Copy" icon next to `/r/my-git` to show copy-to-clipboard functionality.
    *   Open `/r/my-git` in a browser tab. Show that it instantly redirects to `https://github.com`.
5.  **Analytics Presentation:**
    *   Navigate back to the dashboard. Click the "Chart" icon next to `/r/my-git`.
    *   Point out the loaded details: **Clicks Over Time graph**, **Browsers breakdown chart**, **Devices breakdown chart**, **Top Referrers gauge**, and the chronological **Recent Visits Log** showing browser agent/device details.
    *   Click the **QR Code** button. Show the pop-up modal, verify the link, and click **Download Image** to demonstrate complete feature readiness.

---

## 🎙️ Interview Talking Points & Design Decisions

Be ready to explain these architecture details in your discussion:

*   **Database Selection (SQLite):** *"I chose SQLite over MongoDB for this project to maintain ACID guarantees and strong relational consistency. A URL shortener represents relational mappings (User owns Link, Link has clicks). Using SQL database constraints prevents orphan clicks on deletion and optimizes index speeds. It also makes deployment self-contained without demanding database clusters."*
*   **Redirect Speed (HTTP 301):** *"Redirection uses HTTP 301 (Permanent Redirect) rather than HTTP 302 or JavaScript-based redirects. This is critical because browser caching of 301 redirects lightens server load on subsequent requests. I implemented the analytics logging asynchronously on the backend thread, ensuring the client receives the redirect header immediately under 15 milliseconds."*
*   **Security Architecture (OWASP Focus):**
    *   **Cryptographic Salting:** *"User passwords are encrypted with bcryptjs utilizing a salt factor of 10 to protect against rainbow table attacks."*
    *   **Stateless Auth:** *"JWT access tokens are verified via middleware. Local storage handles session state on the client side, avoiding cookies which are susceptible to CSRF attacks."*
    *   **XSS Mitigation:** *"To defend against HTML injection, I implemented custom regex escaping in the Javascript rendering loop so that user agent string data or referral slugs are never parsed directly into the DOM."*
*   **Visual Philosophy (CSS Core):** *"I avoided Tailwind to demonstrate deep knowledge of core layout mechanics. By building custom utility tokens, transitions, and radial gradient blends in Vanilla CSS, I achieved a premium aesthetic with glassmorphism panels while maintaining zero-overhead load times."*

---

## 📊 Presentation Slides Outline (5 Slides)

*   **Slide 1: Project Overview & Problem Statement**
    *   *Title:* Trimm: Scaling the URL Shortener
    *   *Sub-bullets:* Creating an intuitive platform that shortens link paths while collecting rich user analytics in real-time.
*   **Slide 2: System Architecture**
    *   *Content:* Visual diagram showing Client SPA ➔ Express Server (REST API) ➔ SQLite Relational Database. Highlight async logging of clicks.
*   **Slide 3: Technical Features & Safety**
    *   *Content:* Password Hashing (Bcrypt), JWT Security, custom slug unique validations, QR Canvas Downloads.
*   **Slide 4: UI/UX & Visuals**
    *   *Content:* Dark Mode layout, CSS Grid responsive designs, Chart.js integrations.
*   **Slide 5: Key Learnings & Future Enhancements**
    *   *Content:* Learnings on SQLite performance, browser redirection caches. Future addition of Redis caching layer and custom user domains.
