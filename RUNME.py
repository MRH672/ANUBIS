#!/usr/bin/env python3
import subprocess
import sys
import os
from pathlib import Path

REQUIRED_VERSION = "go1.23.0"
ZSHRC = Path.home() / ".zshrc"

def run(cmd, check=True):
    return subprocess.run(cmd, shell=True, check=check, capture_output=True, text=True)

def run_live(cmd, env=None):
    return subprocess.run(cmd, shell=True, check=True, env=env)

def is_installed(package):
    result = run(f"dpkg -l {package} 2>/dev/null | grep -q '^ii'", check=False)
    return result.returncode == 0

def is_binary(binary):
    result = run(f"which {binary} 2>/dev/null", check=False)
    return result.returncode == 0

def get_installed_version():
    for binary in ["/usr/local/go/bin/go", "/usr/bin/go", "go"]:
        result = run(f"{binary} version 2>/dev/null", check=False)
        if result.returncode == 0 and result.stdout:
            return result.stdout.strip().split()[2]
    return None

def go_env():
    env = os.environ.copy()
    env["PATH"] = "/usr/local/go/bin:" + env.get("PATH", "")
    env["HOME"] = str(Path.home())
    return env

# ============================================
#   Python Check & Install
# ============================================

print("[*] Checking Python dependencies...")

for package in ["python3", "python3-pip", "python3-venv"]:
    if is_installed(package):
        print(f"  [OK] {package} already installed — skipping.")
    else:
        print(f"  [*] Installing {package}...")
        run(f"sudo apt install {package} -y")
        print(f"  [OK] {package} installed.")

# ============================================
#   Version Check
# ============================================

print("[*] Checking Go...")
installed = get_installed_version()
print(f"  [*] Found: {installed or 'none'}")

if installed == REQUIRED_VERSION:
    print(f"  [OK] Go {REQUIRED_VERSION} already installed — skipping.")
else:
    print("[*] Removing old Go installations...")
    run("sudo rm -rf /usr/local/go")
    run("sudo rm -f /usr/bin/go /usr/local/bin/go")

    print("[*] Installing Go 1.23.0...")
    run_live("wget -q --show-progress https://go.dev/dl/go1.23.0.linux-amd64.tar.gz -O /tmp/go1.23.tar.gz")
    run("sudo tar -C /usr/local -xzf /tmp/go1.23.tar.gz")
    run("rm /tmp/go1.23.tar.gz")

    if ZSHRC.exists():
        content = ZSHRC.read_text()
        if "/usr/local/go/bin" not in content:
            with open(ZSHRC, "a") as f:
                f.write('\nexport PATH=/usr/local/go/bin:$PATH\n')
                f.write('export PATH=$HOME/go/bin:$PATH\n')

    result = run("/usr/local/go/bin/go version")
    print(f"  {result.stdout.strip()}")
    print("[*] Done!")

# ============================================
#   Mandatory Steps
# ============================================

print("[*] Applying mandatory steps...")
run("sudo apt install golang-go -y")
run("sudo apt install gccgo-go -y")

# ============================================
#   httpx
# ============================================

print("[*] Checking httpx...")
if is_binary("httpx"):
    print("  [OK] httpx already installed — skipping.")
else:
    run("sudo rm -f /usr/local/bin/httpx", check=False)
    run("sudo apt remove httpx -y", check=False)
    print("  [*] Installing httpx...")
    run_live("go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest", env=go_env())
    run("sudo cp ~/go/bin/httpx /usr/local/bin")
    print("  [OK] httpx installed.")

# ============================================
#   assetfinder
# ============================================

print("[*] Checking assetfinder...")
if is_binary("assetfinder"):
    print("  [OK] assetfinder already installed — skipping.")
else:
    print("  [*] Installing assetfinder...")
    run("sudo apt install assetfinder -y")
    print("  [OK] assetfinder installed.")

# ============================================
#   subfinder
# ============================================

print("[*] Checking subfinder...")
if is_binary("subfinder"):
    print("  [OK] subfinder already installed — skipping.")
else:
    print("  [*] Installing subfinder...")
    run("sudo apt install subfinder -y")
    print("  [OK] subfinder installed.")

# ============================================
#   dalfox
# ============================================

print("[*] Checking dalfox...")
if is_binary("dalfox"):
    print("  [OK] dalfox already installed — skipping.")
else:
    print("  [*] Installing dalfox...")
    run_live("go install github.com/hahwul/dalfox/v2@latest", env=go_env())
    run("sudo cp ~/go/bin/dalfox /usr/local/bin")
    print("  [OK] dalfox installed.")

# ============================================
#   SecLists
# ============================================

SECLISTS_PATH = Path.home() / "SecLists"

print("[*] Checking SecLists...")
if SECLISTS_PATH.exists():
    print("  [OK] SecLists already exists — skipping.")
else:
    print("  [*] Cloning SecLists...")
    run_live(f"git clone https://github.com/danielmiessler/SecLists.git {SECLISTS_PATH}")
    print("  [OK] SecLists cloned.")

print("\n[*] All done! Run this command --> source ~/.zshrc")
