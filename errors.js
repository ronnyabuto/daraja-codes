const ERRORS = [
  {
    code: "1037",
    title: "MSISDN Unreachable / No Response From User",
    api: "STK Push",
    category: "callback",
    description: "The STK prompt was sent but M-Pesa received no response from the user's handset within the timeout window.",
    causes: [
      "User took too long to enter their PIN",
      "Phone is off or out of network coverage",
      "Outdated SIM card",
      "Very common with iOS eSIMs"
    ],
    fix: "Prompt the user to check their phone and retry. If the issue persists, ask them to dial *234# to update their M-Pesa menu, then retry.",
    notes: "This is the most Googled Daraja error. Do not treat it as fatal — always offer a retry flow in your UI."
  },
  {
    code: "1032",
    title: "Request Cancelled by User",
    api: "STK Push",
    category: "callback",
    description: "The user deliberately or accidentally dismissed the STK/USSD payment prompt.",
    causes: [
      "User pressed Cancel on the STK prompt",
      "User ignored the prompt until it auto-dismissed"
    ],
    fix: "Re-initiate the STK push request. No action needed on the backend — this is a user-side cancellation."
  },
  {
    code: "1",
    title: "Insufficient Funds",
    api: "STK Push",
    category: "callback",
    description: "The user has neither enough M-Pesa balance nor an available Fuliza overdraft limit to complete the transaction.",
    causes: [
      "M-Pesa wallet balance too low",
      "Fuliza limit exhausted or not activated"
    ],
    fix: "Inform the user they need to top up their M-Pesa account and retry."
  },
  {
    code: "1001",
    title: "Transaction In Progress",
    api: "STK Push",
    category: "callback",
    description: "M-Pesa cannot lock the subscriber because they already have an active USSD session processing another transaction.",
    causes: [
      "User has another M-Pesa transaction in progress",
      "Previous STK push not yet resolved"
    ],
    fix: "Wait 1–2 minutes and retry the payment request."
  },
  {
    code: "1025",
    title: "Unable to Send STK Prompt",
    api: "STK Push",
    category: "request",
    description: "A temporary system issue prevented the STK prompt from being sent, or the TransactionDesc parameter exceeded the character limit.",
    causes: [
      "TransactionDesc field exceeds 182 characters including spaces",
      "Temporary M-Pesa system issue"
    ],
    fix: "Check that your TransactionDesc parameter is under 182 characters. If it is, wait 1–2 minutes and retry.",
    notes: "Error code 9999 is the same error and should be handled identically."
  },
  {
    code: "9999",
    title: "Unable to Send STK Prompt (System Error)",
    api: "STK Push",
    category: "request",
    description: "Alias for error 1025. A system-level failure prevented the STK prompt from being delivered.",
    causes: [
      "Temporary M-Pesa platform instability",
      "TransactionDesc over 182 characters"
    ],
    fix: "Same fix as error 1025 — check TransactionDesc length, then retry after 1–2 minutes.",
    notes: "Treat 9999 and 1025 identically in your error handling logic."
  },
  {
    code: "Invalid Initiator Info",
    title: "Wrong M-Pesa PIN Entered",
    api: "STK Push",
    category: "callback",
    description: "The user entered an incorrect M-Pesa PIN when responding to the STK prompt.",
    causes: [
      "User typed the wrong PIN",
      "User has recently changed their PIN and used the old one"
    ],
    fix: "Prompt the user to retry and enter their correct M-Pesa PIN. Note: M-Pesa allows a maximum of 3 failed PIN attempts."
  },
  {
    code: "400.002.02",
    title: "Invalid BusinessShortCode",
    api: "HTTP",
    category: "request",
    description: "The API rejected the request because the BusinessShortCode value could not be parsed correctly.",
    causes: [
      "In Python, sending the payload using data=payload instead of json=payload",
      "Incorrect shortcode format",
      "Shortcode sent as string when integer expected (or vice versa)"
    ],
    fix: "In Python requests: change data=payload to json=payload. In other languages, ensure the payload is sent as a JSON body with Content-Type: application/json header, not as form data.",
    notes: "This error message is misleading — the shortcode value is usually correct, but the serialisation method is wrong."
  },
  {
    code: "Invalid Access Token (Post Go-Live)",
    title: "Access Token Invalid After Going Live",
    api: "Go-Live",
    category: "auth",
    description: "After switching to production credentials, the access token is rejected even though the same code worked in sandbox.",
    causes: [
      "Daraja app's API product not yet approved for live access",
      "Still using sandbox base URL instead of https://api.safaricom.co.ke/",
      "Consumer key and secret not updated to live credentials",
      "Passkey not updated to the live passkey received via email"
    ],
    fix: "1) Verify all four values are live: Consumer Key, Consumer Secret, Passkey, and base URL. 2) If all four are correct and it still fails, email apisupport@safaricom.co.ke with subject 'Invalid Access Token Error After Going Live', and include your Daraja app ID and shortcode. The issue is usually that Safaricom hasn't finished internal approval.",
    notes: "This is not a code issue 90% of the time. Do not spend hours debugging — escalate to Safaricom support early."
  },
  {
    code: "C2B Sandbox Callbacks Unreliable",
    title: "Confirmation/Validation Callbacks Not Firing in Sandbox",
    api: "C2B",
    category: "callback",
    description: "C2B sandbox callbacks either never arrive or arrive only ~40% of the time, making it impossible to fully test the integration locally.",
    causes: [
      "Known Safaricom sandbox instability for C2B callbacks",
      "Callback URL not publicly accessible (localhost URLs are blocked)",
      "Using ngrok on a free tier (can be blocked by Safaricom)"
    ],
    fix: "For C2B specifically, the developer community consensus is to test against a live deployment rather than sandbox. Deploy to a VPS or platform like Railway, register your real HTTPS URL, and test with small live transactions.",
    notes: "This is a known, long-standing Daraja sandbox limitation, not a bug in your code. Safaricom does not allow ngrok on production callback URLs."
  },
  {
    code: "2001",
    title: "Invalid Initiator Information (B2C / B2B)",
    api: "B2C",
    category: "auth",
    description: "The API operator credentials sent in a B2C or B2B request are invalid. This is a developer-side credential error, not a user PIN error.",
    causes: [
      "InitiatorName does not match what is registered on the Daraja portal",
      "SecurityCredential was encrypted using the wrong certificate (e.g. old G2 certificate instead of the Daraja certificate)",
      "SecurityCredential was encrypted using sandbox certificate in production or vice versa",
      "Initiator does not belong to the shortcode being used"
    ],
    fix: "Download a fresh copy of the public key certificate from your Daraja portal (not from a GitHub repo — those are often outdated G2 certificates). Re-encrypt your initiator password using that certificate and update your SecurityCredential value. Also verify the InitiatorName matches exactly what is on the Daraja portal under your app credentials.",
    notes: "Do not confuse this with the STK Push 'Invalid Initiator Info' entry — that one is about a user entering the wrong PIN. This error code 2001 appears in B2C and B2B result callbacks and is entirely a developer credentials issue."
  },
  {
    code: "1019",
    title: "Transaction Expired",
    api: "STK Push",
    category: "callback",
    description: "The STK Push transaction exceeded the allowable processing time before the user responded.",
    causes: [
      "User did not respond to the STK prompt before it timed out (typically 1–3 minutes depending on phone model)",
      "User's phone was slow to display the prompt due to network lag"
    ],
    fix: "Inform the user their payment request expired and offer them a button to initiate a fresh STK push. Implement a polling loop using the STK Push Query API (stkpushquery endpoint) to catch this state proactively before relying solely on the callback.",
    notes: "Different from error 1037 — 1037 means the prompt never reached the phone. 1019 means the prompt arrived but the user did not act on it in time."
  },
  {
    code: "500.001.1001",
    title: "Wrong Credentials / MerchantValidate Failed",
    api: "STK Push",
    category: "request",
    description: "The Password field in the STK Push request failed validation on Safaricom's backend. The request is rejected before an STK prompt is sent.",
    causes: [
      "The Timestamp value used to build the Password does not match the Timestamp field sent in the request body — they must be identical",
      "Timestamp is in the wrong format (must be YYYYMMDDHHmmss, e.g. 20240315143022)",
      "Wrong passkey used — sandbox passkey used in production or vice versa",
      "Password was not base64-encoded correctly (must be base64 of shortcode + passkey + timestamp concatenated as a plain string)"
    ],
    fix: "Generate the Timestamp once, store it in a variable, and use that exact same variable both to build the Password (base64(shortcode + passkey + timestamp)) and as the Timestamp field in the request body. Never generate the timestamp twice. Verify your passkey matches the environment — sandbox and production have different passkeys.",
    notes: "This error appears in the errorCode field of the immediate API response (not in a callback). The errorMessage is typically '[MerchantValidate] - Wrong credentials'. Confirmed in official Safaricom GitHub issue trackers."
  },
  {
    code: "404.001.03",
    title: "Access Token Expired or Missing",
    api: "HTTP",
    category: "auth",
    description: "The Bearer token in the Authorization header is invalid, expired, or absent. This causes all API calls to fail with a 404 response.",
    causes: [
      "Access token has expired — tokens are valid for exactly 3600 seconds (1 hour)",
      "Token was never refreshed between requests",
      "Authorization header is missing the word 'Bearer ' before the token",
      "Token was generated in sandbox but used against the production endpoint or vice versa"
    ],
    fix: "Implement token caching with automatic refresh: store the token and its expiry time, and regenerate it before it expires rather than on every request. A safe pattern is to refresh the token when it is within 5 minutes of expiry. Ensure your Authorization header is formatted exactly as: 'Bearer <token>' with a space between Bearer and the token value.",
    notes: "This is different from the Go-Live access token issue in this list. That one happens because Safaricom has not yet internally approved the live app. This one (404.001.03) happens during normal operation when token lifecycle is not managed correctly."
  }
];
