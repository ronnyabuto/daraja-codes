# Daraja Error Codes

The missing error code reference for Safaricom's Daraja M-Pesa API.

## Live site
https://ronnyabuto.github.io/daraja-codes

## How to add an error code
1. Fork this repo
2. Open errors.js
3. Add a new object to the ERRORS array following the exact schema in the existing entries
4. Open a pull request with the title "Add error: [code]"

Required fields: code, title, api, category, description, causes (array), fix
Optional fields: notes

Valid values for api: "STK Push", "C2B", "B2C", "B2B", "HTTP", "Go-Live"
Valid values for category: "callback", "request", "auth", "onboarding"

## Run locally
Open index.html in a browser. No server required.

## Deploy
Push to GitHub. Enable GitHub Pages on the main branch root. Done.
