import assert from 'assert';
import http from 'http';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import components directly to test them in isolation or run server process
console.log('Starting API integration tests...');

const TEST_PORT = 3111;
const baseUrl = `http://localhost:${TEST_PORT}`;

// We can run server.js in a separate subprocess or import the server init.
// Since we want to make it super fast, we can import server.js dynamically or just run the file.
// Let's spawn server.js as a subprocess using node's child_process.
import { spawn } from 'child_process';

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    // Set custom port and temporary DB for testing
    const env = { 
      ...process.env, 
      PORT: TEST_PORT.toString(), 
      JWT_SECRET: 'test-secret-123'
    };
    
    serverProcess = spawn('node', ['server.js'], { env });
    
    let output = '';
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes(`Server is running`)) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server error output: ${data}`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  try {
    await startServer();
    console.log('Test server started successfully.');

    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    let token = '';
    let linkId = '';
    let shortCode = '';

    // Test 1: Signup
    console.log('Testing Signup API...');
    const signupRes = await fetch(`${baseUrl}/api/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const signupData = await signupRes.json();
    assert.strictEqual(signupRes.status, 201, `Signup failed: ${JSON.stringify(signupData)}`);
    assert.ok(signupData.userId, 'Signup should return userId');
    console.log('✔ Signup PASSED');

    // Test 2: Login
    console.log('Testing Login API...');
    const loginRes = await fetch(`${baseUrl}/api/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginData)}`);
    assert.ok(loginData.token, 'Login should return token');
    token = loginData.token;
    console.log('✔ Login PASSED');

    // Test 3: Create Shortened Link
    console.log('Testing Shorten Link API...');
    const targetUrl = 'https://www.google.com';
    const createRes = await fetch(`${baseUrl}/api/v1/links`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ longUrl: targetUrl, customCode: `custom_${Date.now()}` })
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201, `Link creation failed: ${JSON.stringify(createData)}`);
    assert.ok(createData.id, 'Should return link ID');
    assert.ok(createData.shortCode, 'Should return short code');
    assert.strictEqual(createData.longUrl, targetUrl, 'Long URL should match');
    linkId = createData.id;
    shortCode = createData.shortCode;
    console.log(`✔ Create Link PASSED (Code: ${shortCode})`);

    // Test 4: Redirect Action
    console.log('Testing URL Redirection...');
    // We expect a 301 redirect. By default, fetch follows redirects. We must check with redirect: 'manual'.
    const redirectRes = await fetch(`${baseUrl}/r/${shortCode}`, {
      method: 'GET',
      redirect: 'manual'
    });
    assert.strictEqual(redirectRes.status, 301, `Redirect status code should be 301, got ${redirectRes.status}`);
    const location = redirectRes.headers.get('location');
    assert.strictEqual(location, targetUrl, `Redirect target should be ${targetUrl}, got ${location}`);
    console.log('✔ Redirect PASSED');

    // Test 5: Verify Analytics Updates
    console.log('Testing Link Analytics Retrieval...');
    const analyticsRes = await fetch(`${baseUrl}/api/v1/links/${linkId}/analytics`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const analyticsData = await analyticsRes.json();
    assert.strictEqual(analyticsRes.status, 200, `Analytics query failed: ${JSON.stringify(analyticsData)}`);
    assert.strictEqual(analyticsData.analytics.totalClicks, 1, `Click count should be 1, got ${analyticsData.analytics.totalClicks}`);
    assert.strictEqual(analyticsData.analytics.recentVisits.length, 1, 'Should record exactly 1 visit');
    console.log('✔ Analytics PASSED');

    // Test 6: Delete Link
    console.log('Testing Link Deletion...');
    const deleteRes = await fetch(`${baseUrl}/api/v1/links/${linkId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteRes.status, 200, `Delete query failed: ${JSON.stringify(deleteData)}`);
    console.log('✔ Delete Link PASSED');

    console.log('🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test execution failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log('Shutting down test server...');
      serverProcess.kill();
    }
  }
}

runTests();
