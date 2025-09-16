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
from pathlib import Path
import threading
import socket

try:
    # Lazy import when minimized mode is used
    import pystray  # type: ignore
    from PIL import Image, ImageDraw  # type: ignore
    PYSTRAY_AVAILABLE = True
except Exception:
    PYSTRAY_AVAILABLE = False

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

def find_available_port(start_port: int = 8000, max_tries: int = 50) -> int:
    """Find an available TCP port starting from start_port."""
    for offset in range(max_tries):
        port = start_port + offset
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("", port))
            s.close()
            return port
        except OSError:
            s.close()
            continue
    return start_port


def create_tray_icon(stop_callback, open_callback):
    # Create a simple circle icon
    size = 64
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((8, 8, size - 8, size - 8), fill=(33, 150, 243, 255))

    menu = pystray.Menu(
        pystray.MenuItem('Open in browser', lambda: open_callback()),
        pystray.MenuItem('Quit', lambda: stop_callback())
    )
    return pystray.Icon('LiquidMusic', image, 'Liquid Music Server', menu)


def main():
    PORT = find_available_port(8000)
    
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if required files exist
    required_files = ['index.html', 'styles.css', 'script.js']
    missing_files = [f for f in required_files if not Path(f).exists()]
    
    if missing_files:
        print(f"Error: Missing required files: {', '.join(missing_files)}")
        sys.exit(1)
    
    # Create server with address reuse
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🎵 Liquid Glass Music Player Server")
        print(f"📡 Server running at http://localhost:{PORT}")
        print(f"🌐 Opening browser...")
        print(f"📁 Serving files from: {script_dir}")
        print(f"⏹️  Press Ctrl+C to stop the server")
        print("-" * 50)
        
        minimized = '--minimized' in sys.argv or '-m' in sys.argv

        def open_browser():
            try:
                webbrowser.open(f'http://localhost:{PORT}')
            except Exception as e:
                print(f"Could not open browser automatically: {e}")
                print(f"Please manually open http://localhost:{PORT}")

        def serve():
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass

        server_thread = threading.Thread(target=serve, daemon=True)
        server_thread.start()

        if minimized and PYSTRAY_AVAILABLE and os.name == 'nt':
            # System tray mode
            def stop_server():
                httpd.shutdown()
                icon.stop()

            icon = create_tray_icon(stop_server, open_browser)
            # Do not auto-open browser in minimized mode
            try:
                icon.run()
            except Exception as e:
                # If tray fails (e.g., missing GUI), fall back to normal open
                print(f"Tray icon failed: {e}. Falling back to normal mode.")
                open_browser()
                server_thread.join()
        else:
            # Normal mode: open browser and block
            open_browser()
            try:
                server_thread.join()
            except KeyboardInterrupt:
                pass
            httpd.shutdown()

if __name__ == "__main__":
    main()

# Version: v3.2.2.2
