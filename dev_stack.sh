#!/bin/bash
# =====================================================
# Dev Stack Orchestrator
# Starts/stops:
#   1) Native TTS server (tts_server.sh)
#   2) Web server (npm start or docker compose)
# =====================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"

TTS_PID_FILE="$RUN_DIR/tts_server.pid"
WEB_PID_FILE="$RUN_DIR/web_server.pid"
WEB_MODE_FILE="$RUN_DIR/web_mode"

DOCKER_COMPOSE_CMD=()

print_usage() {
    cat <<'EOF'
Usage:
  ./dev_stack.sh start [npm|docker]
  ./dev_stack.sh stop
  ./dev_stack.sh restart [npm|docker]
  ./dev_stack.sh status

Notes:
  - Default web mode is "npm".
  - In "npm" mode, TTS_SERVER_URL defaults to http://localhost:8000
    (override with env var TTS_SERVER_URL).
  - Logs are written to:
      logs/tts_server.log
      logs/web_server.log
EOF
}

ensure_dirs() {
    mkdir -p "$RUN_DIR" "$LOG_DIR"
}

is_pid_running() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

read_pid_file() {
    local pid_file="$1"
    if [ ! -f "$pid_file" ]; then
        echo ""
        return 0
    fi
    tr -d '[:space:]' < "$pid_file"
}

detect_docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD=("docker-compose")
        return 0
    fi

    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD=("docker" "compose")
        return 0
    fi

    echo "[stack] docker compose command not found (install Docker Desktop)." >&2
    return 1
}

start_tts() {
    local current_pid
    current_pid="$(read_pid_file "$TTS_PID_FILE")"

    if [ -n "$current_pid" ] && is_pid_running "$current_pid"; then
        echo "[stack] TTS server already running (PID $current_pid)."
        return 0
    fi

    rm -f "$TTS_PID_FILE"
    echo "[stack] Starting TTS server..."
    nohup "$ROOT_DIR/tts_server.sh" >"$LOG_DIR/tts_server.log" 2>&1 &
    local pid="$!"
    echo "$pid" > "$TTS_PID_FILE"

    sleep 1
    if is_pid_running "$pid"; then
        echo "[stack] TTS server started (PID $pid)."
        return 0
    fi

    echo "[stack] Failed to start TTS server. Check logs/tts_server.log" >&2
    rm -f "$TTS_PID_FILE"
    return 1
}

start_web_npm() {
    local current_pid
    current_pid="$(read_pid_file "$WEB_PID_FILE")"

    if [ -n "$current_pid" ] && is_pid_running "$current_pid"; then
        echo "[stack] Web server already running in npm mode (PID $current_pid)."
        echo "npm" > "$WEB_MODE_FILE"
        return 0
    fi

    rm -f "$WEB_PID_FILE"

    local tts_url="${TTS_SERVER_URL:-http://localhost:8000}"
    echo "[stack] Starting web server in npm mode (TTS_SERVER_URL=$tts_url)..."
    (
        cd "$ROOT_DIR"
        TTS_SERVER_URL="$tts_url" nohup npm start >"$LOG_DIR/web_server.log" 2>&1 &
        echo "$!" > "$WEB_PID_FILE"
    )

    local pid
    pid="$(read_pid_file "$WEB_PID_FILE")"
    sleep 1
    if [ -n "$pid" ] && is_pid_running "$pid"; then
        echo "[stack] Web server started (PID $pid)."
        echo "npm" > "$WEB_MODE_FILE"
        return 0
    fi

    echo "[stack] Failed to start web server in npm mode. Check logs/web_server.log" >&2
    rm -f "$WEB_PID_FILE"
    return 1
}

start_web_docker() {
    detect_docker_compose
    echo "[stack] Starting web server in docker mode..."
    (
        cd "$ROOT_DIR"
        "${DOCKER_COMPOSE_CMD[@]}" up --build -d >>"$LOG_DIR/web_server.log" 2>&1
    )
    echo "docker" > "$WEB_MODE_FILE"
    rm -f "$WEB_PID_FILE"
    echo "[stack] Web server started in docker mode."
}

stop_pid_process() {
    local name="$1"
    local pid_file="$2"
    local pid

    pid="$(read_pid_file "$pid_file")"
    if [ -z "$pid" ]; then
        echo "[stack] $name is not running."
        rm -f "$pid_file"
        return 0
    fi

    if ! is_pid_running "$pid"; then
        echo "[stack] $name has stale PID ($pid). Cleaning up."
        rm -f "$pid_file"
        return 0
    fi

    echo "[stack] Stopping $name (PID $pid)..."
    kill "$pid" 2>/dev/null || true

    local i
    for i in $(seq 1 20); do
        if ! is_pid_running "$pid"; then
            break
        fi
        sleep 0.25
    done

    if is_pid_running "$pid"; then
        echo "[stack] Force stopping $name (PID $pid)..."
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$pid_file"
    echo "[stack] $name stopped."
}

stop_web() {
    local mode
    mode="$(read_pid_file "$WEB_MODE_FILE")"
    if [ -z "$mode" ]; then
        mode="npm"
    fi

    if [ "$mode" = "docker" ]; then
        detect_docker_compose
        echo "[stack] Stopping web server in docker mode..."
        (
            cd "$ROOT_DIR"
            "${DOCKER_COMPOSE_CMD[@]}" down >>"$LOG_DIR/web_server.log" 2>&1
        )
        rm -f "$WEB_MODE_FILE" "$WEB_PID_FILE"
        echo "[stack] Web server stopped (docker mode)."
        return 0
    fi

    stop_pid_process "Web server" "$WEB_PID_FILE"
    rm -f "$WEB_MODE_FILE"
}

stop_tts() {
    stop_pid_process "TTS server" "$TTS_PID_FILE"
}

print_status_pid() {
    local name="$1"
    local pid_file="$2"
    local pid
    pid="$(read_pid_file "$pid_file")"

    if [ -z "$pid" ]; then
        echo "[stack] $name: stopped"
        return 0
    fi

    if is_pid_running "$pid"; then
        echo "[stack] $name: running (PID $pid)"
    else
        echo "[stack] $name: stale PID file ($pid)"
    fi
}

status_stack() {
    local mode
    mode="$(read_pid_file "$WEB_MODE_FILE")"
    if [ -z "$mode" ]; then
        mode="npm"
    fi

    print_status_pid "TTS server" "$TTS_PID_FILE"

    if [ "$mode" = "docker" ]; then
        echo "[stack] Web server mode: docker"
        if detect_docker_compose; then
            (
                cd "$ROOT_DIR"
                "${DOCKER_COMPOSE_CMD[@]}" ps
            )
        fi
        return 0
    fi

    echo "[stack] Web server mode: npm"
    print_status_pid "Web server" "$WEB_PID_FILE"
}

resolve_mode() {
    local raw_mode="${1:-npm}"
    case "$raw_mode" in
        npm|--npm) echo "npm" ;;
        docker|--docker) echo "docker" ;;
        *)
            echo "[stack] Invalid mode: $raw_mode (expected npm or docker)" >&2
            return 1
            ;;
    esac
}

start_stack() {
    local mode="$1"
    start_tts
    if [ "$mode" = "docker" ]; then
        start_web_docker
    else
        start_web_npm
    fi
    echo "[stack] Stack is up."
}

ensure_dirs

COMMAND="${1:-}"
MODE_RAW="${2:-npm}"

case "$COMMAND" in
    start)
        MODE="$(resolve_mode "$MODE_RAW")"
        start_stack "$MODE"
        ;;
    stop)
        stop_web
        stop_tts
        echo "[stack] Stack is down."
        ;;
    restart)
        MODE="$(resolve_mode "$MODE_RAW")"
        stop_web
        stop_tts
        start_stack "$MODE"
        ;;
    status)
        status_stack
        ;;
    *)
        print_usage
        exit 1
        ;;
esac

