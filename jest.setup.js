/**
 * Jest Setup File
 * Runs before test suites
 */

// Polyfill for NextJS Request/Response in jsdom environment
const { TextEncoder, TextDecoder } = require('util');

Object.assign(global, {
  TextEncoder,
  TextDecoder,
});

// Suppress console output during tests if needed
// beforeAll(() => {
//   jest.spyOn(console, 'log').mockImplementation(() => {});
// });

// afterAll(() => {
//   jest.restoreAllMocks();
// });
