#!/usr/bin/env python3
"""
Installation script for Liquid Glass Music Player dependencies
Run this script to install the required Python packages
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a Python package using pip."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        return True
    except subprocess.CalledProcessError:
        return False

def main():
    print("🎵 Liquid Glass Music Player - Dependency Installer")
    print("=" * 50)
    
    # Check if we're in the right directory
    required_files = ['server.py', 'metadata_reader.py']
    missing_files = [f for f in required_files if not os.path.exists(f)]
    
    if missing_files:
        print(f"❌ Error: Missing required files: {', '.join(missing_files)}")
        print("Please run this script from the music player directory.")
        sys.exit(1)
    
    # Install mutagen
    print("📦 Installing mutagen (audio metadata library)...")
    if install_package("mutagen>=1.47.0"):
        print("✅ mutagen installed successfully!")
    else:
        print("❌ Failed to install mutagen")
        print("Please install it manually: pip install mutagen")
        sys.exit(1)
    
    # Install Pillow
    print("📦 Installing Pillow (image processing library)...")
    if install_package("Pillow>=9.0.0"):
        print("✅ Pillow installed successfully!")
    else:
        print("❌ Failed to install Pillow")
        print("Please install it manually: pip install Pillow")
        sys.exit(1)
    
    # Test the installation
    print("\n🧪 Testing installation...")
    try:
        from mutagen import File
        print("✅ mutagen import successful!")
    except ImportError:
        print("❌ mutagen import failed")
        sys.exit(1)
    
    try:
        from PIL import Image
        print("✅ Pillow import successful!")
    except ImportError:
        print("❌ Pillow import failed")
        sys.exit(1)
    
    print("\n🎉 Installation complete!")
    print("You can now run the music player with: python server.py")
    print("The metadata extraction feature will be available.")

if __name__ == "__main__":
    main()

# Version: v5.2.0
