# 🎵 Python Metadata Extraction System

## Overview

The Liquid Glass Music Player now includes a powerful Python-based metadata extraction system that can read ID3 tags and other metadata from audio files much more reliably than JavaScript-based solutions.

## 🚀 Features

- **Real ID3 Tag Reading**: Extracts actual metadata from MP3, FLAC, MP4, OGG, and other audio formats
- **Fallback Filename Parsing**: If no metadata tags are found, intelligently parses filenames
- **Background Processing**: Runs seamlessly in the background when you upload files
- **No GUI Required**: The metadata reader works automatically with the web interface

## 📁 Files Added

- `metadata_reader.py` - Standalone metadata extraction script
- `install_dependencies.py` - Automatic dependency installer
- `requirements.txt` - Python package requirements
- `METADATA_README.md` - This documentation

## 🛠️ Installation

### Automatic Installation (Recommended)
```bash
python install_dependencies.py
```

### Manual Installation
```bash
pip install mutagen>=1.47.0
pip install Pillow>=9.0.0
```

## 🎯 How It Works

1. **Upload File**: When you upload an audio file through the web interface
2. **Python Processing**: The file is sent to the Python backend for metadata extraction
3. **ID3 Tag Reading**: Python uses the `mutagen` library to read actual metadata tags
4. **Album Art Extraction**: Cover images are extracted from ID3 tags and resized for web display
5. **Fallback Parsing**: If no tags are found, it parses the filename intelligently
6. **Display Results**: The extracted metadata and album art are displayed in the music player

## 🔧 Supported Formats

- **MP3**: ID3v1, ID3v2.3, ID3v2.4 tags
- **FLAC**: Vorbis comments
- **MP4/M4A**: iTunes metadata
- **OGG**: Vorbis comments
- **WMA**: ASF metadata

## 📊 Extracted Metadata

- **Title**: Song title
- **Artist**: Artist name
- **Album**: Album name
- **Year**: Release year
- **Genre**: Music genre
- **Track Number**: Track position in album
- **Duration**: Song length in seconds
- **Album Art**: Cover image (extracted from ID3 tags and displayed in UI)

## 🧪 Testing the System

### Test with Command Line
```bash
# Test a single file
python metadata_reader.py "Artist - Song.mp3" --json

# Test with fallback parsing
python metadata_reader.py "Artist - Song.mp3" --fallback
```

### Test with Web Interface
1. Start the server: `python server.py`
2. Open http://localhost:8000
3. Upload an MP3 file with ID3 tags
4. Check the browser console for metadata extraction logs

## 🔍 Debugging

### Console Logs
The system provides detailed logging:
```
Initializing music player with smart filename metadata extraction...
Starting to add track: [filename]
Extracting metadata using Python backend: [filename]
Sending file to Python metadata extractor...
Python metadata response: {artist: "...", title: "..."}
Found Python-extracted metadata: {artist: "...", title: "..."}
```

### Server Logs
The Python server will show metadata extraction requests and responses.

## 🚨 Troubleshooting

### "Metadata extraction not available"
- Make sure `mutagen` is installed: `pip install mutagen`
- Check that `metadata_reader.py` is in the same directory as `server.py`

### "Error reading metadata"
- The file might be corrupted or in an unsupported format
- Check the file with a media player to ensure it's valid

### No metadata found
- The file might not have ID3 tags
- The system will fall back to filename parsing
- Try renaming your file to "Artist - Song Title.mp3" format

## 🎵 Example Usage

### Filename Formats That Work Well
- `"Artist Name - Song Title.mp3"`
- `"Artist - Album - Song Title.mp3"`
- `"Artist - Song Title (2023).mp3"`
- `"Artist_Song_Title.mp3"`

### ID3 Tags
The system will automatically read ID3 tags if they exist in your MP3 files. You can add/edit these using tools like:
- MP3Tag (Windows)
- Kid3 (Cross-platform)
- iTunes (Mac/Windows)

## 🔄 Integration

The metadata system is fully integrated with the existing music player:
- No changes needed to the web interface
- Works with all existing features (playlists, custom playlists, etc.)
- Maintains backward compatibility
- Automatic fallback to filename parsing if Python extraction fails

## 📈 Performance

- **Fast**: Python metadata extraction is much faster than JavaScript parsing
- **Reliable**: Uses industry-standard libraries (mutagen)
- **Non-blocking**: Doesn't freeze the web interface
- **Efficient**: Only processes files when needed

---

**Ready to use!** Just start the server with `python server.py` and upload your audio files. The metadata extraction will work automatically in the background! 🎉

---

**Version: v5.2.0**
