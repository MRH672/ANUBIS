#!/usr/bin/env python3
import subprocess
import sys
import os
from pathlib import Path

REQUIRED_VERSION = "go1.23.0"
ZSHRC             = Path.home() / ".zshrc"
TOOLS_DIR         = Path.home() / "tools"

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
    env          = os.environ.copy()
    env["PATH"]  = "/usr/local/go/bin:" + env.get("PATH", "")
    env["HOME"]  = str(Path.home())
    return env

def install_go_tool(name, pkg):
    print(f"[*] Checking {name}...")
    if is_binary(name):
        print(f"    [OK]   {name} already installed — skipping.")
        return
    print(f"    [*]    Installing {name}...")
    run_live(f"go install -v {pkg}@latest", env=go_env())
    run(f"sudo cp ~/go/bin/{name} /usr/local/bin")
    print(f"    [OK]   {name} installed.")

def install_apt_tool(name, package=None):
    package = package or name
    print(f"[*] Checking {name}...")
    if is_binary(name):
        print(f"    [OK]   {name} already installed — skipping.")
        return
    print(f"    [*]    Installing {name}...")
    result = run(f"sudo apt install {package} -y", check=False)
    if result.returncode != 0:
        print(f"    [WARN] {name} not found in apt — skipping.")
    else:
        print(f"    [OK]   {name} installed.")

def install_git_tool(name, repo, post_install=None):
    print(f"[*] Checking {name}...")
    tool_path = TOOLS_DIR / name
    if tool_path.exists():
        print(f"    [OK]   {name} already exists — skipping.")
        return
    print(f"    [*]    Cloning {name}...")
    TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    run_live(f"git clone {repo} {tool_path}")
    if post_install:
        run_live(post_install.format(tool_path=tool_path))
    print(f"    [OK]   {name} cloned to {tool_path}")

# ============================================
#   Python Check & Install
# ============================================

print("[*] Checking Python dependencies...")
for package in ["python3", "python3-pip", "python3-venv"]:
    if is_installed(package):
        print(f"    [OK]   {package} already installed — skipping.")
    else:
        print(f"    [*]    Installing {package}...")
        run(f"sudo apt install {package} -y")
        print(f"    [OK]   {package} installed.")

# ============================================
#   Go Version Check & Install
# ============================================

print("[*] Checking Go...")
installed = get_installed_version()
print(f"    [*]    Found: {installed or 'none'}")

if installed == REQUIRED_VERSION:
    print(f"    [OK]   Go {REQUIRED_VERSION} already installed — skipping.")
else:
    print("    [*]    Removing old Go installations...")
    run("sudo rm -rf /usr/local/go")
    run("sudo rm -f /usr/bin/go /usr/local/bin/go")

    print("    [*]    Installing Go 1.23.0...")
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
    print(f"    [OK]   {result.stdout.strip()}")

# ============================================
#   Mandatory Steps
# ============================================

print("[*] Applying mandatory steps...")

if is_installed("golang-go"):
    print("    [OK]   golang-go already installed — skipping.")
else:
    print("    [*]    Installing golang-go...")
    run("sudo apt install golang-go -y", check=False)
    print("    [OK]   golang-go installed.")

if is_installed("gccgo-go"):
    print("    [OK]   gccgo-go already installed — skipping.")
else:
    print("    [*]    Installing gccgo-go...")
    run("sudo apt install gccgo-go -y", check=False)
    print("    [OK]   gccgo-go installed.")

# ============================================
#   APT Tools
# ============================================

apt_tools = [
    ("nmap",        "nmap"),
    ("whatweb",     "ruby-whatweb"),
    ("gobuster",    "gobuster"),
    ("ffuf",        "ffuf"),
    ("sqlmap",      "sqlmap"),
    ("commix",      "commix"),
    ("testssl.sh",  "testssl.sh"),
    ("assetfinder", "assetfinder"),
    ("subfinder",   "subfinder"),
]

for name, pkg in apt_tools:
    install_apt_tool(name, pkg)

# ============================================
#   Go Tools
# ============================================

go_tools = [
    ("httpx",  "github.com/projectdiscovery/httpx/cmd/httpx"),
    ("nuclei", "github.com/projectdiscovery/nuclei/v3/cmd/nuclei"),
    ("katana", "github.com/projectdiscovery/katana/cmd/katana"),
    ("dalfox", "github.com/hahwul/dalfox/v2"),
]

for name, pkg in go_tools:
    install_go_tool(name, pkg)

# ============================================
#   GitHub Tools
# ============================================

git_tools = [
    (
        "PwnTraverse",
        "https://github.com/odaysec/PwnTraverse.git",
        None
    ),
    (
        "STEWS",
        "https://github.com/PalindromeLabs/STEWS.git",
        None
    ),
]

for name, repo, post in git_tools:
    install_git_tool(name, repo, post)

# ============================================
#   SecLists
# ============================================

SECLISTS_PATH = Path.home() / "SecLists"
print("[*] Checking SecLists...")
if SECLISTS_PATH.exists():
    print("    [OK]   SecLists already exists — skipping.")
else:
    print("    [*]    Cloning SecLists...")
    run_live(f"git clone https://github.com/danielmiessler/SecLists.git {SECLISTS_PATH}")
    print("    [OK]   SecLists cloned.")

print("\n[*] All done! Run: source ~/.zshrc")
