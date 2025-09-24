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
        # Lightweight API endpoint for version info
        if self.path.startswith('/version'):
            return self.handle_version_info()
        # Music folder API endpoints
        elif self.path == '/api/music-folder':
            return self.handle_music_folder_list()
        elif self.path.startswith('/api/music-file/'):
            return self.handle_music_file()
        elif self.path.startswith('/api/music-metadata/'):
            return self.handle_music_metadata()
        # Fallback to default static file serving
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

    def handle_version_info(self):
        """Return current version and attempt to fetch latest version (best-effort)."""
        try:
            current_version = "v5.2.0"

            # Best-effort latest version fetch from GitHub; tolerate offline
            latest_version = None
            try:
                import urllib.request
                import ssl
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                req = urllib.request.Request(
                    'https://raw.githubusercontent.com/Jahbas/Liquid-Music/main/README.md',
                    headers={'User-Agent': 'Liquid-Music-Updater'}
                )
                with urllib.request.urlopen(req, timeout=3, context=ctx) as resp:
                    text = resp.read().decode('utf-8', errors='ignore')
                    # Look for a semantic version marker like Version: vX.Y.Z or badge
                    import re
                    # Try multiple patterns to find the version
                    patterns = [
                        r"Version:\s*v(\d+\.\d+\.\d+(?:\.\d+)?)",  # Version: v5.2.0
                        r"Version-(\d+\.\d+\.\d+(?:\.\d+)?)",      # Version-5.2.0 (badge)
                        r"Version[\s:-]*v(\d+\.\d+\.\d+(?:\.\d+)?)" # General pattern
                    ]
                    
                    for pattern in patterns:
                        m = re.search(pattern, text, re.IGNORECASE)
                        if m:
                            latest_version = f"v{m.group(1)}"
                            break
            except Exception:
                latest_version = None

            payload = {
                'current': current_version,
                'latest': latest_version,
                'update_available': (latest_version is not None and latest_version != current_version)
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error generating version info: {str(e)}")

    def handle_music_folder_list(self):
        """List all music files in the music folder."""
        try:
            music_folder = Path('music')
            
            if not music_folder.exists():
                self.send_error(404, "Music folder not found")
                return
            
            # Get all audio files
            audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
            music_files = []
            
            for file_path in music_folder.rglob('*'):
                if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                    music_files.append({
                        'name': file_path.name,
                        'path': str(file_path.relative_to(music_folder)),
                        'size': file_path.stat().st_size,
                        'modified': file_path.stat().st_mtime
                    })
            
            # Sort by name
            music_files.sort(key=lambda x: x['name'].lower())
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(music_files).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Error listing music folder: {str(e)}")

    def handle_music_file(self):
        """Serve a specific music file from the music folder."""
        try:
            # Extract file path from URL (includes subfolders)
            file_path_str = urllib.parse.unquote(self.path.split('/api/music-file/')[-1])
            music_folder = Path('music')
            file_path = music_folder / file_path_str
            
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "Music file not found")
                return
            
            # Check if it's an audio file
            audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
            if file_path.suffix.lower() not in audio_extensions:
                self.send_error(400, "Not an audio file")
                return
            
            # Serve the file
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')  # Default to MP3
            self.send_header('Content-Length', str(file_path.stat().st_size))
            self.end_headers()
            
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            self.send_error(500, f"Error serving music file: {str(e)}")

    def handle_music_metadata(self):
        """Extract metadata from a music file in the music folder."""
        try:
            # Extract file path from URL (includes subfolders)
            file_path_str = urllib.parse.unquote(self.path.split('/api/music-metadata/')[-1])
            music_folder = Path('music')
            file_path = music_folder / file_path_str
            
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "Music file not found")
                return
            
            # Check if it's an audio file
            audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'}
            if file_path.suffix.lower() not in audio_extensions:
                self.send_error(400, "Not an audio file")
                return
            
            # Import metadata extraction function
            from metadata_reader import extract_metadata, parse_filename_metadata
            
            # Extract metadata
            metadata = extract_metadata(str(file_path))
            
            # If extraction failed, try filename parsing as fallback
            if 'error' in metadata:
                filename = file_path.name  # Use just the filename for parsing
                filename_metadata = parse_filename_metadata(filename)
                metadata = {**filename_metadata, "file_name": filename}
            
            # Send JSON response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response_data = json.dumps(metadata, indent=2)
            self.wfile.write(response_data.encode('utf-8'))
                
        except Exception as e:
            self.send_error(500, f"Error extracting metadata: {str(e)}")

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
    
    # Create music folder if it doesn't exist
    music_folder = Path('music')
    if not music_folder.exists():
        music_folder.mkdir()
        print(f"📁 Created music folder: {music_folder.absolute()}")
        print(f"💡 Add your music files to this folder for unlimited storage!")
    
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

# Version: v5.2.0
