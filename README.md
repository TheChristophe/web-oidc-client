# Web OIDC Client

## Introduction
This package provides a simple web browser client for OIDC authentication.

It is implemented as a state machine emitting state updates as events.
An example React/Next.js usage implementation can be found under examples/next.js/AuthProvider.tsx.

## Basic usage

```ts
const authClient = new AuthClient({
    clientId: 'fooBar',
    //redirectUrl: `${window.location.origin}/oauth-redirect` // default
    scopes: 'openid profile offline_access',
    
    authority: 'https://boop.fynn.ai/oidc', // using .well-known/openid-configuration
    // -- OR --
    endpoints: {
      authorization: "https://boop.fynn.ai/oidc/auth",
      token: "https://boop.fynn.ai/oidc/token",
      revocation: "https://boop.fynn.ai/oidc/token/revocation",
      userinfo: "https://boop.fynn.ai/oidc/me"
    }
    
    // not functional at the moment
    //autoLogin: true, // default
  },
  (newStatus: Status) => console.log(status)
);
```

Once you are in the browser, call `authClient.browserInit()` for it to start its flow. 
To log in, call `authClient.login()`, to logout, call `authClient.logout()`.
Changes in status will be communicated to the outside world through the event handler passed as second argument.

## States
![image](https://github.com/TheChristophe/web-oidc-client/assets/65168240/d09a1984-6f40-492a-b410-70ba4d7f1bd7)

