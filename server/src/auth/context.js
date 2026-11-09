import { AsyncLocalStorage } from 'node:async_hooks';
import { HttpError } from '../errors.js';

export const authStore = new AsyncLocalStorage();

export function currentUser() {
  const user = authStore.getStore();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return user;
}
