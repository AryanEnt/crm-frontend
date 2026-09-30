/**
 * Plain-language validation copy. Say what to do, not what went wrong
 * ("Enter your name", not "Name is required").
 */
export const messages = {
  enter: (thing: string) => `Enter ${thing}`,
  choose: (thing: string) => `Choose ${thing}`,
  email: "Enter a valid email address, like name@company.com",
  minLength: (n: number) => `Use at least ${n} characters`,
  maxLength: (n: number) => `Use ${n} characters or fewer`,
  passwordsMatch: "Passwords don't match",
  passwordDifferent: "Choose a password you haven't used for this account",
  currentPasswordWrong: "That isn't your current password",
} as const;
