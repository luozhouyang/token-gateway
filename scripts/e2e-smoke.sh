#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${TOKEN_GATEWAY_E2E_PORT:-18080}"
UPSTREAM_PORT="${TOKEN_GATEWAY_E2E_UPSTREAM_PORT:-18081}"
DB_PATH="${TOKEN_GATEWAY_E2E_DB:-/tmp/token-gateway-e2e.db}"
CLI_LOG="${TOKEN_GATEWAY_E2E_LOG:-/tmp/token-gateway-e2e-server.log}"
UPSTREAM_LOG="${TOKEN_GATEWAY_E2E_UPSTREAM_LOG:-/tmp/token-gateway-e2e-httpbin.log}"

CLI_PID=""
UPSTREAM_PID=""
UI_HTML_FILE=""

cleanup() {
  if [[ -n "${CLI_PID}" ]] && kill -0 "${CLI_PID}" >/dev/null 2>&1; then
    kill "${CLI_PID}" >/dev/null 2>&1 || true
    wait "${CLI_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${UPSTREAM_PID}" ]] && kill -0 "${UPSTREAM_PID}" >/dev/null 2>&1; then
    kill "${UPSTREAM_PID}" >/dev/null 2>&1 || true
    wait "${UPSTREAM_PID}" >/dev/null 2>&1 || true
  fi

  rm -f "${DB_PATH}"

  if [[ -n "${UI_HTML_FILE}" ]]; then
    rm -f "${UI_HTML_FILE}"
  fi
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-60}"

  for ((i = 1; i <= attempts; i++)); do
    if curl --compressed -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.5
  done

  echo "Timed out waiting for ${url}" >&2
  return 1
}

json_read() {
  local path="$1"

  node -e '
    const keys = process.argv[1].split(".");
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      let value = JSON.parse(input);
      for (const key of keys) {
        value = value?.[key];
      }

      if (value === undefined) {
        process.exit(1);
      }

      if (typeof value === "string") {
        process.stdout.write(value);
        return;
      }

      process.stdout.write(JSON.stringify(value));
    });
  ' "${path}"
}

assert_proxy_response() {
  node -e '
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      const payload = JSON.parse(input);

      if (payload.method !== "GET") {
        throw new Error(`Unexpected method: ${payload.method}`);
      }

      if (payload.url !== "/anything?foo=bar") {
        throw new Error(`Unexpected upstream URL: ${payload.url}`);
      }

      if (payload.headers["x-test-header"] !== "smoke") {
        throw new Error("Missing forwarded X-Test-Header");
      }

      if (payload.headers["x-gateway-service"] !== "httpbin") {
        throw new Error("Missing X-Gateway-Service header");
      }

      process.stdout.write("Proxy response verified\n");
    });
  '
}

require_command curl
require_command node
require_command vp

echo "Building packaged CLI bundle..."
(
  cd "${ROOT_DIR}/packages/cli"
  vp run bundle >/dev/null
)

echo "Starting httpbin fixture on ${UPSTREAM_PORT}..."
node "${ROOT_DIR}/scripts/e2e-httpbin-fixture.mjs" "${UPSTREAM_PORT}" >"${UPSTREAM_LOG}" 2>&1 &
UPSTREAM_PID=$!

echo "Starting Token Gateway on ${PORT}..."
node "${ROOT_DIR}/packages/cli/dist/index.mjs" start --port "${PORT}" --db "${DB_PATH}" >"${CLI_LOG}" 2>&1 &
CLI_PID=$!

wait_for_url "http://127.0.0.1:${PORT}/ui/"
wait_for_url "http://127.0.0.1:${PORT}/admin/services"

echo "Checking web UI..."
UI_HTML_FILE="$(mktemp /tmp/token-gateway-e2e-ui.XXXXXX.html)"
curl --compressed -fsS "http://127.0.0.1:${PORT}/ui/" -o "${UI_HTML_FILE}"
if ! grep -qi "<html" "${UI_HTML_FILE}"; then
  echo "Web UI did not return HTML" >&2
  exit 1
fi

echo "Registering service..."
SERVICE_RESPONSE="$(
  curl -fsS \
    --compressed \
    -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"httpbin\",\"url\":\"http://127.0.0.1:${UPSTREAM_PORT}\"}" \
    "http://127.0.0.1:${PORT}/admin/services"
)"
SERVICE_ID="$(printf '%s' "${SERVICE_RESPONSE}" | json_read 'data.id')"

echo "Registering route..."
ROUTE_RESPONSE="$(
  curl -fsS \
    --compressed \
    -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"httpbin-route\",\"serviceId\":\"${SERVICE_ID}\",\"paths\":[\"/httpbin\"],\"stripPath\":true}" \
    "http://127.0.0.1:${PORT}/admin/routes"
)"
printf '%s' "${ROUTE_RESPONSE}" | json_read 'data.id' >/dev/null

echo "Sending proxied request..."
PROXY_RESPONSE="$(
  curl -fsS \
    --compressed \
    -H 'X-Test-Header: smoke' \
    "http://127.0.0.1:${PORT}/httpbin/anything?foo=bar"
)"
printf '%s' "${PROXY_RESPONSE}" | assert_proxy_response

echo "Smoke test passed."
echo "Logs:"
echo "  CLI: ${CLI_LOG}"
echo "  Fixture: ${UPSTREAM_LOG}"
