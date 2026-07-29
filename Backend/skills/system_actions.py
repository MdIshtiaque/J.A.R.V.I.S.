import os
import webbrowser
import psutil
import platform

def open_website(target: str) -> str:
    """Open YouTube, Google, Facebook, Instagram, GitHub, etc., in default browser"""
    target_clean = target.strip().lower()
    
    url_map = {
        "youtube": "https://www.youtube.com",
        "google": "https://www.google.com",
        "facebook": "https://www.facebook.com",
        "instagram": "https://www.instagram.com",
        "github": "https://www.github.com",
        "twitter": "https://www.x.com",
        "x": "https://www.x.com",
        "reddit": "https://www.reddit.com",
    }
    
    url = url_map.get(target_clean, target_clean)
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://www.{target_clean}.com" if not target_clean.endswith(".com") else f"https://{target_clean}"
        
    try:
        webbrowser.open(url)
        return f"Opened {target} in web browser ({url})."
    except Exception as e:
        return f"Failed to open {target}: {e}"

def get_storage_info() -> str:
    """Inspect system disk space, RAM memory usage, and OS details"""
    try:
        disk = psutil.disk_usage('/')
        total_gb = disk.total / (1024 ** 3)
        free_gb = disk.free / (1024 ** 3)
        used_gb = disk.used / (1024 ** 3)
        percent = disk.percent

        ram = psutil.virtual_memory()
        ram_total_gb = ram.total / (1024 ** 3)
        ram_free_gb = ram.available / (1024 ** 3)

        os_name = platform.system() + " " + platform.release()

        return (
            f"OS: {os_name} | "
            f"Disk: {free_gb:.1f} GB Free of {total_gb:.1f} GB ({percent}% used) | "
            f"RAM: {ram_free_gb:.1f} GB Available of {ram_total_gb:.1f} GB"
        )
    except Exception as e:
        return f"System info error: {e}"

def run(action: str = "storage", target: str = "google", **kwargs) -> str:
    if action == "open_website" or target:
        return open_website(target)
    return get_storage_info()
