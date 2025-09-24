#!/usr/bin/env python3
"""
Audio Metadata Reader
A standalone script to extract metadata from audio files using the mutagen library.
Can be run independently or integrated with the music player server.
"""

import os
import sys
import json
import argparse
import base64
import io
from pathlib import Path

try:
    from mutagen import File
    from mutagen.id3 import ID3NoHeaderError, APIC
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC, Picture
    from mutagen.mp4 import MP4
    from mutagen.oggvorbis import OggVorbis
    from mutagen.asf import ASF
    from PIL import Image
    PIL_AVAILABLE = True
    MUTAGEN_AVAILABLE = True
except ImportError as e:
    if "PIL" in str(e):
        PIL_AVAILABLE = False
        print("Warning: PIL/Pillow not found. Album art resizing will be disabled.")
        print("Install it with: pip install Pillow")
    else:
        print("Warning: mutagen library not found. Metadata extraction will be disabled.")
        print("Install it with: pip install mutagen")
        # Set all mutagen imports to None to prevent errors
        File = None
        ID3NoHeaderError = None
        APIC = None
        MP3 = None
        FLAC = None
        Picture = None
        MP4 = None
        OggVorbis = None
        ASF = None
        MUTAGEN_AVAILABLE = False


def extract_metadata(file_path):
    """
    Extract metadata from an audio file using mutagen.
    
    Args:
        file_path (str): Path to the audio file
        
    Returns:
        dict: Extracted metadata or None if extraction fails
    """
    # Check if mutagen is available
    if not MUTAGEN_AVAILABLE:
        return {"error": "mutagen library not available. Install with: pip install mutagen"}
    
    try:
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}
        
        # Load the audio file
        audio_file = File(file_path)
        
        if audio_file is None:
            return {"error": f"Unsupported file format: {file_path}"}
        
        # Initialize metadata dictionary
        metadata = {
            "title": None,
            "artist": None,
            "album": None,
            "year": None,
            "genre": None,
            "track_number": None,
            "duration": None,
            "file_size": os.path.getsize(file_path),
            "file_name": os.path.basename(file_path),
            "album_art": None,
            "album_art_mime": None
        }
        
        # Extract common metadata fields
        if hasattr(audio_file, 'tags') and audio_file.tags:
            tags = audio_file.tags
            
            # Title
            if 'TIT2' in tags:  # ID3v2
                metadata["title"] = str(tags['TIT2'][0])
            elif 'TITLE' in tags:  # Vorbis, FLAC
                metadata["title"] = str(tags['TITLE'][0])
            elif '\xa9nam' in tags:  # MP4
                metadata["title"] = str(tags['\xa9nam'][0])
            elif 'Title' in tags:  # ASF
                metadata["title"] = str(tags['Title'][0])
            
            # Artist
            if 'TPE1' in tags:  # ID3v2
                metadata["artist"] = str(tags['TPE1'][0])
            elif 'ARTIST' in tags:  # Vorbis, FLAC
                metadata["artist"] = str(tags['ARTIST'][0])
            elif '\xa9ART' in tags:  # MP4
                metadata["artist"] = str(tags['\xa9ART'][0])
            elif 'Author' in tags:  # ASF
                metadata["artist"] = str(tags['Author'][0])
            
            # Album
            if 'TALB' in tags:  # ID3v2
                metadata["album"] = str(tags['TALB'][0])
            elif 'ALBUM' in tags:  # Vorbis, FLAC
                metadata["album"] = str(tags['ALBUM'][0])
            elif '\xa9alb' in tags:  # MP4
                metadata["album"] = str(tags['\xa9alb'][0])
            elif 'WM/AlbumTitle' in tags:  # ASF
                metadata["album"] = str(tags['WM/AlbumTitle'][0])
            
            # Year
            if 'TDRC' in tags:  # ID3v2.4
                metadata["year"] = str(tags['TDRC'][0])
            elif 'TYER' in tags:  # ID3v2.3
                metadata["year"] = str(tags['TYER'][0])
            elif 'DATE' in tags:  # Vorbis, FLAC
                metadata["year"] = str(tags['DATE'][0])
            elif '\xa9day' in tags:  # MP4
                metadata["year"] = str(tags['\xa9day'][0])
            elif 'WM/Year' in tags:  # ASF
                metadata["year"] = str(tags['WM/Year'][0])
            
            # Genre
            if 'TCON' in tags:  # ID3v2
                genre = str(tags['TCON'][0])
                # Remove ID3v1 genre numbers if present
                if genre.startswith('(') and ')' in genre:
                    genre = genre.split(')', 1)[1]
                metadata["genre"] = genre
            elif 'GENRE' in tags:  # Vorbis, FLAC
                metadata["genre"] = str(tags['GENRE'][0])
            elif '\xa9gen' in tags:  # MP4
                metadata["genre"] = str(tags['\xa9gen'][0])
            elif 'WM/Genre' in tags:  # ASF
                metadata["genre"] = str(tags['WM/Genre'][0])
            
            # Track number
            if 'TRCK' in tags:  # ID3v2
                track = str(tags['TRCK'][0])
                if '/' in track:
                    track = track.split('/')[0]
                metadata["track_number"] = track
            elif 'TRACKNUMBER' in tags:  # Vorbis, FLAC
                track = str(tags['TRACKNUMBER'][0])
                if '/' in track:
                    track = track.split('/')[0]
                metadata["track_number"] = track
            elif 'trkn' in tags:  # MP4
                metadata["track_number"] = str(tags['trkn'][0][0])
        
        # Extract album art
        album_art_data = extract_album_art(audio_file)
        if album_art_data:
            metadata["album_art"] = album_art_data["data"]
            metadata["album_art_mime"] = album_art_data["mime"]
        
        # Get duration
        if hasattr(audio_file, 'info') and audio_file.info:
            metadata["duration"] = round(audio_file.info.length, 2)
        
        # Clean up None values
        metadata = {k: v for k, v in metadata.items() if v is not None}
        
        return metadata
        
    except Exception as e:
        return {"error": f"Error reading metadata: {str(e)}"}


def extract_album_art(audio_file):
    """
    Extract album art from an audio file.
    
    Args:
        audio_file: Mutagen audio file object
        
    Returns:
        dict: Album art data with 'data' (base64) and 'mime' fields, or None
    """
    try:
        if not hasattr(audio_file, 'tags') or not audio_file.tags:
            return None
        
        tags = audio_file.tags
        album_art_data = None
        mime_type = None
        
        # Try different formats
        if isinstance(audio_file, MP3):
            # MP3 with ID3 tags - try multiple APIC variations
            apic_keys = ['APIC:', 'APIC:cover', 'APIC:front cover', 'APIC:other', 'APIC:back cover']
            for key in apic_keys:
                if key in tags:
                    apic = tags[key]
                    album_art_data = apic.data
                    mime_type = apic.mime
                    break
            
            # If no APIC found, try to find any picture frame
            if not album_art_data:
                for key in tags.keys():
                    if key.startswith('APIC'):
                        apic = tags[key]
                        album_art_data = apic.data
                        mime_type = apic.mime
                        break
        
        elif isinstance(audio_file, FLAC):
            # FLAC with Vorbis comments
            if 'METADATA_BLOCK_PICTURE' in tags:
                # FLAC can have multiple pictures, get the first one
                picture_data = tags['METADATA_BLOCK_PICTURE'][0]
                picture = Picture(base64.b64decode(picture_data))
                album_art_data = picture.data
                mime_type = picture.mime
        
        elif isinstance(audio_file, MP4):
            # MP4/M4A files
            if 'covr' in tags:
                # MP4 can have multiple covers, get the first one
                cover_data = tags['covr'][0]
                album_art_data = cover_data
                mime_type = 'image/jpeg'  # MP4 covers are usually JPEG
        
        elif isinstance(audio_file, OggVorbis):
            # OGG Vorbis files
            if 'METADATA_BLOCK_PICTURE' in tags:
                picture_data = tags['METADATA_BLOCK_PICTURE'][0]
                picture = Picture(base64.b64decode(picture_data))
                album_art_data = picture.data
                mime_type = picture.mime
        
        elif isinstance(audio_file, ASF):
            # WMA/ASF files
            if 'WM/Picture' in tags:
                # ASF picture data is more complex, skip for now
                pass
        
        if album_art_data:
            # Resize image if PIL is available
            if PIL_AVAILABLE:
                try:
                    # Convert bytes to PIL Image
                    image = Image.open(io.BytesIO(album_art_data))
                    
                    # Resize to reasonable size (300x300 max)
                    max_size = 300
                    if image.width > max_size or image.height > max_size:
                        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    
                    # Convert back to bytes
                    output = io.BytesIO()
                    if mime_type == 'image/png':
                        image.save(output, format='PNG')
                    else:
                        image.save(output, format='JPEG', quality=85)
                    
                    album_art_data = output.getvalue()
                except Exception as e:
                    pass  # Use original image data if resize fails
            
            # Convert to base64 for web transmission
            base64_data = base64.b64encode(album_art_data).decode('utf-8')
            
            return {
                "data": base64_data,
                "mime": mime_type or "image/jpeg"
            }
        
        return None
        
    except Exception as e:
        return None


def parse_filename_metadata(filename):
    """
    Fallback method to extract metadata from filename.
    
    Args:
        filename (str): The filename to parse
        
    Returns:
        dict: Parsed metadata from filename
    """
    # Remove file extension
    name_without_ext = os.path.splitext(filename)[0]
    
    # Common patterns
    patterns = [
        # "Artist - Song Title"
        r'^(.+?)\s*-\s*(.+)$',
        # "Artist - Album - Song Title"
        r'^(.+?)\s*-\s*(.+?)\s*-\s*(.+)$',
        # "Artist - Song Title (Year)"
        r'^(.+?)\s*-\s*(.+?)\s*\((\d{4})\)$',
        # "Artist - Album - Song Title (Year)"
        r'^(.+?)\s*-\s*(.+?)\s*-\s*(.+?)\s*\((\d{4})\)$',
        # "Artist - Song Title [Year]"
        r'^(.+?)\s*-\s*(.+?)\s*\[(\d{4})\]$',
        # "Artist_Song_Title"
        r'^(.+?)_(.+)$',
    ]
    
    import re
    
    for pattern in patterns:
        match = re.match(pattern, name_without_ext)
        if match:
            groups = match.groups()
            metadata = {}
            
            if len(groups) == 2:
                metadata["artist"] = groups[0].strip()
                metadata["title"] = groups[1].strip()
            elif len(groups) == 3:
                if re.search(r'\d{4}', groups[2]):
                    # Has year
                    metadata["artist"] = groups[0].strip()
                    metadata["title"] = groups[1].strip()
                    metadata["year"] = groups[2].strip()
                else:
                    # Has album
                    metadata["artist"] = groups[0].strip()
                    metadata["album"] = groups[1].strip()
                    metadata["title"] = groups[2].strip()
            elif len(groups) == 4:
                metadata["artist"] = groups[0].strip()
                metadata["album"] = groups[1].strip()
                metadata["title"] = groups[2].strip()
                metadata["year"] = groups[3].strip()
            
            return metadata
    
    return {"title": name_without_ext}


def main():
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(description='Extract metadata from audio files')
    parser.add_argument('file', help='Audio file to analyze')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--fallback', action='store_true', help='Use filename parsing as fallback')
    
    args = parser.parse_args()
    
    # Extract metadata
    metadata = extract_metadata(args.file)
    
    # If extraction failed and fallback is enabled, try filename parsing
    if 'error' in metadata and args.fallback:
        filename = os.path.basename(args.file)
        filename_metadata = parse_filename_metadata(filename)
        metadata = {**filename_metadata, "file_name": filename}
    
    # Output result
    if args.json:
        print(json.dumps(metadata, indent=2))
    else:
        if 'error' in metadata:
            print(f"Error: {metadata['error']}")
        else:
            print("Metadata extracted:")
            for key, value in metadata.items():
                print(f"  {key}: {value}")


if __name__ == "__main__":
    main()

# Version: v5.2.0
