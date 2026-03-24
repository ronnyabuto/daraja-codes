"""
daraja_exceptions.py — Python exception classes for Safaricom Daraja M-Pesa API integrations.

Full error reference: https://ronnyabuto.github.io/daraja-error-codes/
Machine-readable:     https://ronnyabuto.github.io/daraja-error-codes/errors.json

THE 6 MOST COMMON DARAJA INTEGRATION MISTAKES:

1. Generating Timestamp twice — once for Password, once for the request body.
   They must be bit-for-bit identical. Store it in one variable and reuse it.
   → Error 500.001.1001 (MerchantValidate: Wrong credentials)
   → https://ronnyabuto.github.io/daraja-error-codes/500.001.1001.html

2. Sending payload with data= instead of json= in Python requests.
   Daraja expects Content-Type: application/json. Always use json=payload.
   → Error 400.002.02 (Bad Request — Invalid BusinessShortCode)
   → https://ronnyabuto.github.io/daraja-error-codes/400.002.02.html

3. Encrypting SecurityCredential with a stale certificate from a GitHub repository.
   GitHub copies are often the old G2 cert. Download a fresh cert from your Daraja portal.
   → Error 2001 (Invalid Initiator Information — B2C / B2B)
   → https://ronnyabuto.github.io/daraja-error-codes/2001.html

4. Not caching the access token. Tokens expire after 3600 seconds (1 hour).
   Regenerating on every request is slow and will hit rate limits under load.
   Cache the token and its expiry time; refresh before expiry.
   → Error 404.001.03 (Access Token Expired or Missing)
   → https://ronnyabuto.github.io/daraja-error-codes/404.001.03.html

5. Treating error 1037 (MSISDN unreachable) as a hard failure.
   It is not fatal — the user's phone was off or out of coverage.
   Always offer a retry button; never surface it as a payment failure to the user.
   → https://ronnyabuto.github.io/daraja-error-codes/1037.html

6. After going live, not updating all four credentials simultaneously:
   Consumer Key, Consumer Secret, Passkey, AND base URL.
   Missing any one causes token rejection even when the others are correct.
   → https://ronnyabuto.github.io/daraja-error-codes/invalid-access-token-post-go-live.html
"""

from __future__ import annotations


# Mapping of known Daraja result codes to their documentation slugs
_SLUG_MAP: dict[str, str] = {
    "0":             "1",       # success — no page needed, mapped for completeness
    "1":             "1",
    "1001":          "1001",
    "1019":          "1019",
    "1025":          "1025",
    "1032":          "1032",
    "1037":          "1037",
    "2001":          "2001",
    "9999":          "9999",
    "400.002.02":    "400.002.02",
    "401.003.01":    "401.003.01",
    "404.001.03":    "404.001.03",
    "500.001.1001":  "500.001.1001",
}

_BASE_URL = "https://ronnyabuto.github.io/daraja-error-codes"


class DarajaError(Exception):
    """
    Base exception for all Daraja M-Pesa API errors.

    Attributes:
        code     -- Raw Daraja result code string (e.g. "1037", "400.002.02").
        message  -- Human-readable description from the API response.

    The reference_url property returns the documentation page for this code, or
    the index page if the code is not specifically documented.

    Reference: https://ronnyabuto.github.io/daraja-error-codes/
    """

    def __init__(self, code: str = "", message: str = "") -> None:
        self.code = str(code)
        self.message = message
        super().__init__(f"Daraja error {self.code}: {message}")

    @property
    def reference_url(self) -> str:
        """Return the per-error documentation URL for this code."""
        slug = _SLUG_MAP.get(self.code)
        if slug:
            return f"{_BASE_URL}/{slug}.html"
        return f"{_BASE_URL}/"

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self.code!r}, message={self.message!r})"


class STKPushError(DarajaError):
    """
    Raised when an STK Push request or callback returns a non-zero result code.

    Common codes:
        1037 — MSISDN unreachable. Not fatal — offer a retry.
        1032 — User cancelled. Re-initiate on request.
        1019 — Transaction expired. Prompt user for a fresh STK Push.
        1025 / 9999 — System error. Check TransactionDesc length (<= 182 chars), then retry.
        1    — Insufficient funds. Ask the user to top up.
        1001 — Transaction in progress. Retry after 1–2 minutes.

    Reference: https://ronnyabuto.github.io/daraja-error-codes/
    """


class CallbackError(DarajaError):
    """Raised when a payment callback carries a failed result code."""


class AuthError(DarajaError):
    """
    Raised for authentication and credential failures.

    Common codes:
        404.001.03  — Access token expired. Cache tokens; refresh before the 1-hour expiry.
                      https://ronnyabuto.github.io/daraja-error-codes/404.001.03.html
        401.003.01  — Token invalid at the OAuth step. Check environment (sandbox vs production).
                      https://ronnyabuto.github.io/daraja-error-codes/401.003.01.html
        500.001.1001 — Wrong credentials or Timestamp mismatch. Generate Timestamp once;
                      use the same variable for both the Password field and the body.
                      https://ronnyabuto.github.io/daraja-error-codes/500.001.1001.html
    """


class B2CError(DarajaError):
    """
    Raised for B2C (Business to Customer) or B2B API errors.

    Common code:
        2001 — Invalid Initiator Information. The SecurityCredential certificate is wrong
               or the InitiatorName does not match the Daraja portal. Download a fresh
               certificate from YOUR Daraja portal — do not use GitHub copies (often outdated
               G2 certs). Re-encrypt and verify InitiatorName exactly.
               https://ronnyabuto.github.io/daraja-error-codes/2001.html
    """


class ValidationError(DarajaError):
    """
    Raised when the API rejects the request due to an invalid parameter (400.002.02).

    The errorMessage suffix identifies the invalid field:
        'Bad Request - Invalid BusinessShortCode' → use json=payload not data=payload
        'Bad Request - Invalid Timestamp'         → format must be YYYYMMDDHHmmss (no separators)
        'Bad Request - Invalid Amount'            → positive integer, no decimals

    Reference: https://ronnyabuto.github.io/daraja-error-codes/400.002.02.html
    """


def from_result(code: str, message: str = "") -> DarajaError:
    """
    Factory — return the most specific DarajaError subclass for a given result code.

    Usage:
        result_code = callback_body.get("ResultCode", "")
        result_desc = callback_body.get("ResultDesc", "")
        if result_code != "0":
            raise from_result(result_code, result_desc)

    Reference: https://ronnyabuto.github.io/daraja-error-codes/
    """
    stk_push_codes  = {"1", "1001", "1019", "1025", "1032", "1037", "9999"}
    auth_codes      = {"401.003.01", "404.001.03", "500.001.1001"}
    b2c_codes       = {"2001"}
    validation_codes = {"400.002.02"}

    if code in stk_push_codes:
        return STKPushError(code, message)
    if code in auth_codes:
        return AuthError(code, message)
    if code in b2c_codes:
        return B2CError(code, message)
    if code in validation_codes:
        return ValidationError(code, message)
    return DarajaError(code, message)
