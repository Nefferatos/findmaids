import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failures = new Rate('request_failures');
const base = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
export const options = {
  scenarios: {
    directory: { executor: 'ramping-vus', startVUs: 1, stages: [{ duration: '30s', target: 5 }, { duration: '2m', target: 20 }, { duration: '30s', target: 0 }], exec: 'directory' },
    profile: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: '2m', preAllocatedVUs: 10, maxVUs: 30, exec: 'profile' },
    ...(__ENV.ENABLE_CHAT_LOAD === '1' ? { chat: { executor: 'constant-arrival-rate', rate: 2, timeUnit: '1s', duration: '2m', preAllocatedVUs: 5, maxVUs: 15, exec: 'chat' } } : {}),
    ...(__ENV.ENABLE_ENQUIRY_LOAD === '1' ? { enquiry: { executor: 'constant-arrival-rate', rate: 1, timeUnit: '1s', duration: '1m', preAllocatedVUs: 2, maxVUs: 5, exec: 'enquiry' } } : {}),
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'], request_failures: ['rate<0.01'] },
};

export function directory() {
  const response = http.get(`${base}/agencies?city=${encodeURIComponent(__ENV.CITY || 'Makati')}`);
  const ok = check(response, { 'directory returns 200': (res) => res.status === 200 });
  failures.add(!ok);
  sleep(1);
}

export function profile() {
  if (!__ENV.AGENCY_SLUG) throw new Error('Set AGENCY_SLUG to an approved staging profile.');
  const response = http.get(`${base}/agencies/${encodeURIComponent(__ENV.AGENCY_SLUG)}`);
  const ok = check(response, { 'profile returns 200': (res) => res.status === 200 });
  failures.add(!ok);
}

export function chat() {
  const response = http.post(`${base}/api/ai/chat`, JSON.stringify({ message: 'Find an approved nanny agency in Makati', language: 'en' }), { headers: { 'Content-Type': 'application/json' } });
  const ok = check(response, { 'chat accepts message': (res) => res.status === 200 });
  failures.add(!ok);
}

export function enquiry() {
  const response = http.post(`${base}/api/enquiries`, JSON.stringify({ agencyId: __ENV.AGENCY_ID, name: 'Load Test User', email: `load-${__VU}-${__ITER}@example.test`, phone: '', message: 'Staging load test enquiry; remove after run.', consentGiven: true }), { headers: { 'Content-Type': 'application/json' } });
  const ok = check(response, { 'enquiry accepted or throttled': (res) => res.status === 201 || res.status === 429 });
  failures.add(!ok);
}

function defaultScenario() {
  directory();
}

export default defaultScenario;
