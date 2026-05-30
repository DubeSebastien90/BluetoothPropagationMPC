export class MockRouter {
  send(to, body) {
    console.log(`[MockRouter] send to=${to} body=${body}`);
  }
  start() {}
  stop() {}
}
