#!/usr/bin/env python3
"""
Simple HTTP server to host the Liquid Glass Music Player
Run this script and open http://localhost:8000 in your browser
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow file uploads
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()

def main():
    PORT = 8000
    
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if required files exist
    required_files = ['index.html', 'styles.css', 'script.js']
    missing_files = [f for f in required_files if not Path(f).exists()]
    
    if missing_files:
        print(f"Error: Missing required files: {', '.join(missing_files)}")
        sys.exit(1)
    
    # Create server
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🎵 Liquid Glass Music Player Server")
        print(f"📡 Server running at http://localhost:{PORT}")
        print(f"🌐 Opening browser...")
        print(f"📁 Serving files from: {script_dir}")
        print(f"⏹️  Press Ctrl+C to stop the server")
        print("-" * 50)
        
        # Open browser
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except Exception as e:
            print(f"Could not open browser automatically: {e}")
            print(f"Please manually open http://localhost:{PORT}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped by user")
            httpd.shutdown()

if __name__ == "__main__":
    main()

# Version: v2.3.1
