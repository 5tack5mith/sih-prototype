"""Authenticated Compose smoke test for the running API."""
import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE_URL = os.environ.get("API_URL", "http://api:8000")


def request(path: str, method: str = "GET", payload: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        with urlopen(Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method), timeout=15) as response:
            return response.status, json.loads(response.read() or b"{}")
    except HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def main() -> int:
    username = os.environ["AUTH_BOOTSTRAP_ADMIN_USERNAME"]
    password = os.environ["AUTH_BOOTSTRAP_ADMIN_PASSWORD"]
    status, login = request("/login", "POST", {"username": username, "password": password})
    if status != 200 or "access_token" not in login:
        raise RuntimeError(f"admin login failed: {status} {login}")
    status, user = request("/me", token=login["access_token"])
    if status != 200 or user != {"username": username, "role": "admin"}:
        raise RuntimeError(f"authenticated /me failed: {status} {user}")
    status, _ = request("/cases", token=login["access_token"])
    if status != 200:
        raise RuntimeError(f"authenticated /cases failed: {status}")
    print("Authentication smoke test passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
