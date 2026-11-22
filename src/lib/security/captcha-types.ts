export type CaptchaPayload =
  | {
      provider: 'bypass';
    }
  | {
      provider: 'turnstile';
      token: string;
    }
  | {
      provider: 'local';
      challengeToken: string;
      solution: string;
      honeypot?: string;
    };
