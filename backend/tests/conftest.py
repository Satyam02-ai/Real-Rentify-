import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": "owner1@test.com", "password": "pass123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tenant_token():
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": "tenant1@test.com", "password": "pass123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def owner_h(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture
def tenant_h(tenant_token):
    return {"Authorization": f"Bearer {tenant_token}"}
