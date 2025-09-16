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
import json
import tempfile
import urllib.parse
import urllib.request
import re
from pathlib import Path

# Import our metadata reader
try:
    from metadata_reader import extract_metadata, parse_filename_metadata
    METADATA_AVAILABLE = True
except ImportError:
    METADATA_AVAILABLE = False
    print("Warning: metadata_reader.py not found. Metadata extraction will be disabled.")

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

    def do_POST(self):
        """Handle POST requests for metadata extraction."""
        if self.path == '/extract-metadata':
            self.handle_metadata_extraction()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        """Extend GET to support a simple proxy for remote audio downloads."""
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/version':
            return self.handle_version_info()
        if parsed.path == '/proxy':
            return self.handle_proxy_request(parsed)
        if parsed.path == '/resolve-title':
            return self.handle_resolve_title(parsed)
        return super().do_GET()

    def handle_metadata_extraction(self):
        """Extract metadata from uploaded audio file."""
        if not METADATA_AVAILABLE:
            self.send_error(503, "Metadata extraction not available")
            return

        try:
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "No file data received")
                return

            # Read file data
            file_data = self.rfile.read(content_length)
            
            # Get filename from headers
            filename = self.headers.get('X-Filename', 'unknown.mp3')
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name

            try:
                # Extract metadata
                metadata = extract_metadata(temp_file_path)
                
                # If extraction failed, try filename parsing
                if 'error' in metadata:
                    filename_metadata = parse_filename_metadata(filename)
                    metadata = {**filename_metadata, "file_name": filename}
                    metadata["extraction_method"] = "filename"
                else:
                    metadata["extraction_method"] = "tags"
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(metadata).encode('utf-8'))
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass

        except Exception as e:
            self.send_error(500, f"Error processing file: {str(e)}")

    def handle_proxy_request(self, parsed_path):
        """Proxy a remote URL to bypass CORS for client downloads (audio files)."""
        try:
            qs = urllib.parse.parse_qs(parsed_path.query)
            target_list = qs.get('url', [])
            if not target_list:
                self.send_error(400, "Missing url parameter")
                return

            target_url = target_list[0]
            # Basic validation: only http/https
            t_parsed = urllib.parse.urlparse(target_url)
            if t_parsed.scheme not in ('http', 'https'):
                self.send_error(400, "Unsupported URL scheme")
                return

            req = urllib.request.Request(target_url, headers={
                'User-Agent': 'LiquidMusicDownloader/1.0'
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                status = getattr(resp, 'status', 200)
                content_type = resp.headers.get('Content-Type', 'application/octet-stream')
                content_disp = resp.headers.get('Content-Disposition')
                content_len = resp.headers.get('Content-Length')

                self.send_response(status)
                self.send_header('Content-Type', content_type)
                if content_disp:
                    self.send_header('Content-Disposition', content_disp)
                if content_len:
                    self.send_header('Content-Length', content_len)
                # Avoid content-length if unknown; stream chunks
                self.end_headers()

                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

        except Exception as e:
            self.send_error(502, f"Proxy error: {e}")

    def handle_resolve_title(self, parsed_path):
        """Fetch a public page and attempt to extract a human-readable title (e.g., from MEGA)."""
        try:
            qs = urllib.parse.parse_qs(parsed_path.query)
            target_list = qs.get('url', [])
            if not target_list:
                self.send_error(400, "Missing url parameter")
                return
            target_url = target_list[0]
            t_parsed = urllib.parse.urlparse(target_url)
            if t_parsed.scheme not in ('http', 'https'):
                self.send_error(400, "Unsupported URL scheme")
                return

            # Fetch HTML
            req = urllib.request.Request(target_url, headers={
                'User-Agent': 'LiquidMusicResolver/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                charset = 'utf-8'
                ctype = resp.headers.get('Content-Type') or ''
                if 'charset=' in ctype:
                    charset = ctype.split('charset=')[-1].split(';')[0].strip()
                html = resp.read().decode(charset, errors='ignore')

            import re, html as htmlmod
            title = None
            # Try OpenGraph title
            m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if m:
                title = m.group(1)
            # Fallback to <title>
            if not title:
                m2 = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
                if m2:
                    title = m2.group(1)
            if title:
                title = htmlmod.unescape(title).strip()
                # Clean common MEGA suffix/prefix
                title = re.sub(r'\s*-\s*MEGA.*$', '', title, flags=re.IGNORECASE)
                title = re.sub(r'^MEGA\s*-\s*', '', title, flags=re.IGNORECASE)
                # Strip common audio extensions if present
                title = re.sub(r'\.(mp3|opus|wav|flac|m4a)$', '', title, flags=re.IGNORECASE)
            else:
                title = 'Unknown Title'

            data = { 'title': title }
            out = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        except Exception as e:
            self.send_error(502, f"Resolve error: {e}")

    def handle_version_info(self):
        """Return current version and attempt to fetch latest version (best-effort)."""
        try:
            # Keep current version aligned with this branch
            current_version = "v3.3.1"

            latest_version = None
            try:
                req = urllib.request.Request(
                    'https://raw.githubusercontent.com/Jahbas/Liquid-Music/main/README.md',
                    headers={'User-Agent': 'Liquid-Music-Updater'}
                )
                with urllib.request.urlopen(req, timeout=4) as resp:
                    text = resp.read().decode('utf-8', errors='ignore')
                    m = re.search(r"Version[\s:-]*v(\d+\.\d+\.\d+(?:\.\d+)?)", text, re.IGNORECASE)
                    if m:
                        latest_version = f"v{m.group(1)}"
            except Exception:
                latest_version = None

            payload = {
                'current': current_version,
                'latest': latest_version,
                'update_available': (latest_version is not None and latest_version != current_version)
            }
            out = json.dumps(payload).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        except Exception as e:
            self.send_error(500, f"Error generating version info: {str(e)}")

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

# Version: v3.3.1
