// Typed API client. Reads VITE_API_MODE to decide between MSW mocks and the live API.
// Placeholder in this pass.

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const API_MODE = import.meta.env.VITE_API_MODE ?? 'mock';
