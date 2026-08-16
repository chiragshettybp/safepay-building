/**
 * SafePay Checkout — drop-in JS SDK for merchants.
 *
 * The merchant creates a checkout session server-side with their secret key
 * and receives a `checkout_url`. This SDK opens that URL for the customer.
 *
 * Usage (redirect mode — recommended):
 *
 *   <script src="https://YOUR_FRONTEND/safepay-checkout.js"></script>
 *   <script>
 *     const checkout = SafepayCheckout({
 *       checkoutUrl: 'https://YOUR_FRONTEND/integration-checkout/cs_xxx',
 *     });
 *     checkout.open({ paymentMode: 'redirect' });
 *   </script>
 *
 * Options:
 *   checkoutUrl     (optional) full SafePay checkout URL from api.create-session.
 *   sessionId       (optional) checkout session id, resolved into a checkout
 *                   URL at runtime via the API.
 *   publishableKey  (optional) sp_test_publishable_... / sp_live_publishable_...
 *                   Client-side safe. Use with sessionId to resolve checkoutUrl.
 *   secretKey       (optional) sp_test_secret_... / sp_live_secret_... Use with
 *                   sessionId in trusted contexts; prefer server-side creation.
 *   apiBase        (optional) override the function endpoint. Defaults to the
 *                   hosted SafePay endpoint.
 *
 * open(options):
 *   paymentMode    'redirect' (default) or 'popup'.
 *   Returns a Promise that resolves once the checkout is opened.
 */
(function (global) {
  "use strict";

  const DEFAULT_API_BASE =
    "https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/checkout-integration";

  function postJson(url, headers, body) {
    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () {
        return null;
      }).then(function (payload) {
        if (!res.ok || !payload || payload.error) {
          var err = new Error(
            (payload && (payload.error && payload.error.message)) ||
              (payload && payload.error) ||
              "SafePay request failed"
          );
          err.code = payload && payload.error && payload.error.code;
          throw err;
        }
        return payload;
      });
    });
  }

  function resolveCheckoutUrl(options) {
    if (options.checkoutUrl) return Promise.resolve(options.checkoutUrl);
    var key = options.secretKey || options.publishableKey;
    if (key && options.sessionId) {
      return postJson(
        options.apiBase || DEFAULT_API_BASE,
        {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        { action: "api.get-session", session_id: options.sessionId }
      ).then(function (session) {
        if (!session || !session.checkout_url) {
          throw new Error("Checkout session could not be resolved");
        }
        return session.checkout_url;
      });
    }
    return Promise.reject(
      new Error("SafepayCheckout requires a checkoutUrl (or sessionId + a publishableKey/secretKey)")
    );
  }

  function SafepayCheckout(options) {
    if (!options || typeof options !== "object") {
      throw new Error("SafepayCheckout requires an options object");
    }
    return {
      open: function (openOptions) {
        var opts = openOptions || {};
        var mode = opts.paymentMode || "redirect";
        return resolveCheckoutUrl(options).then(function (url) {
          if (mode === "redirect") {
            global.location.assign(url);
            return;
          }
          if (mode === "popup") {
            global.open(url, "safepay_checkout", "popup=yes,width=420,height=640");
            return;
          }
          throw new Error("Unsupported paymentMode: " + mode);
        });
      },
    };
  }

  global.SafepayCheckout = SafepayCheckout;
})(typeof window !== "undefined" ? window : this);
