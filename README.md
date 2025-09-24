# 🎵 Liquid Glass Music Player

[![Test Here](https://img.shields.io/badge/Test%20Here-Live%20Demo-brightgreen?style=for-the-badge&logo=github)](https://jahbas.github.io/Liquid-Music/)

<div align="center">

![Liquid Glass Music Player](https://img.shields.io/badge/Status-Ready%20to%20Use-brightgreen)
![Version](https://img.shields.io/badge/Version-5.2.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Browser Support](https://img.shields.io/badge/Browser%20Support-Modern%20Browsers-orange)
![Developer](https://img.shields.io/badge/Developer-Solo%20Developer-purple)

*A stunning, modern music player with liquid glass aesthetics, album art display, and intelligent metadata extraction*

[<img alt="Download" src="https://img.shields.io/badge/Download-ZIP-blue?logo=github" />](https://github.com/Jahbas/Liquid-Music/archive/refs/heads/main.zip)

[🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [🎮 Controls](#-controls) • [📊 Metadata System](#-metadata-system)

</div>

---

## 🌟 What Makes This Special?

Experience music like never before with **Liquid Glass Music Player v5.2.0** - a beautifully crafted web application developed by a solo developer that combines cutting-edge design with powerful functionality. Featuring mesmerizing glassmorphism effects, automatic album art display, intelligent metadata extraction, and an intuitive interface that makes managing your music collection a joy.

### 🎨 Visual Excellence
- **Liquid Glass Design**: Translucent cards with backdrop blur effects that create depth and elegance
- **Dynamic Album Art**: Automatic display of album covers from your music files
- **Smart Animations**: Spinning CD animation only when no album art is available
- **Animated Background**: Floating gradient orbs that dance across your screen
- **Smooth Transitions**: Every interaction feels fluid and responsive
- **Dark/Light Themes**: Easy theme switching with proper album art visibility

### 🎵 Powerful Features
- **Intelligent Metadata Extraction**: Reads artist, album, title, year, genre from audio files
- **Album Art Display**: Shows cover images extracted from ID3 tags and other metadata
- **Smart File Management**: Upload individual files or entire folders with automatic audio detection
- **Custom Playlists**: Create unlimited playlists with custom names
- **Persistent Storage**: Your music library is automatically saved and restored
- **Advanced Controls**: Full playback control with shuffle, repeat, and volume management
- **Multi-Format Support**: MP3, FLAC, MP4, OGG, WMA with proper metadata reading

---

## ✨ Features

### 🎨 **Design & Aesthetics**
- **Glassmorphism Effects**: Beautiful translucent cards with backdrop blur
- **Dynamic Album Art**: Automatic display of album covers from metadata
- **Smart Visual Feedback**: Spinning CD animation only when no album art present
- **Animated Gradient Orbs**: Dynamic background elements for visual appeal
- **Smooth Hover Effects**: Interactive feedback on all elements
- **Responsive Design**: Perfect on desktop, tablet, and mobile devices
- **Theme Support**: Light and dark modes with proper album art visibility

### 🎵 **Music Management & Metadata**
- **Intelligent Metadata Extraction**: 
  - Reads ID3 tags from MP3 files
  - Extracts Vorbis comments from FLAC/OGG files
  - Parses iTunes metadata from MP4/M4A files
  - Handles ASF metadata from WMA files
- **Album Art Extraction**: Automatically displays cover images from audio files
- **Smart Fallback**: Uses filename parsing when metadata tags are unavailable
- **Drag & Drop Support**: Simply drag files or folders onto the player
- **Multiple Upload Methods**: File picker, folder selection
- **Custom Playlists**: Create themed collections with custom names
- **Persistent Storage**: All your music, metadata, and settings saved locally

### 🎮 **Playback Controls**
- **Full Player Controls**: Play, pause, skip, shuffle, and repeat modes
- **Interactive Progress Bar**: Click or drag to seek through tracks
- **Volume Control**: Smooth real-time volume adjustment with keyboard shortcuts
- **Keyboard Shortcuts**: Complete control via keyboard (Space, arrows, M, S, R)
- **Visual Feedback**: Loading states, smooth transitions, and volume notifications
- **Track Information**: Displays title, artist, and album from metadata

### ⚙️ **Advanced Features**
- **Python Backend**: Robust metadata extraction using mutagen library
- **Performance Optimized**: Built for speed with efficient memory management
- **Action Logs**: Track all your actions with undo functionality
- **Settings Panel**: Easy access to all customization options
- **Error Handling**: Graceful fallbacks when metadata extraction fails

---

## 🚀 Quick Start

### 🪟 One-Click on Windows (Recommended)
1) Download the repository ZIP using the "Download" button above.
2) Extract the ZIP anywhere (e.g., Desktop).
3) Double‑click `start.bat`.

`start.bat` will automatically:
- Install or bootstrap pip if missing (ensurepip / get-pip fallback)
- Install all dependencies (requirements + metadata deps)
- Start the Python server

Then open http://localhost:8000 in your browser.

---

### 🐍 **Option 1: Python Server (Manual)**
```bash
# Clone or download the project
cd Liquid-Music

# Install dependencies (first time only)
python install_dependencies.py

# Start the server
python server.py
```
Then open **http://localhost:8000** in your browser.

**Note**: The Python server enables full metadata extraction and album art display.

### 📁 **Option 2: Direct File Access (Basic Features)**
Simply open `index.html` in your web browser - no server required!

**Note**: Without the Python server, only basic filename-based metadata will be available.

### 🌐 **Option 3: Live Demo**
The player works entirely in your browser with no external dependencies for basic functionality.

---

## 📊 Metadata System

### 🔍 **Supported Audio Formats & Metadata**
| Format | Metadata Support | Album Art | Notes |
|--------|------------------|-----------|-------|
| **MP3** | ✅ ID3v1, ID3v2.3, ID3v2.4 | ✅ APIC frames | Most common format |
| **FLAC** | ✅ Vorbis comments | ✅ METADATA_BLOCK_PICTURE | Lossless compression |
| **MP4/M4A** | ✅ iTunes metadata | ✅ covr atoms | Apple's audio format |
| **OGG** | ✅ Vorbis comments | ✅ METADATA_BLOCK_PICTURE | Open source format |
| **WMA** | ✅ ASF metadata | ⚠️ Limited support | Windows Media Audio |

### 🎯 **Extracted Information**
- **Title**: Song title from metadata tags
- **Artist**: Artist name from metadata tags
- **Album**: Album name from metadata tags
- **Year**: Release year from metadata tags
- **Genre**: Music genre from metadata tags
- **Track Number**: Track position in album
- **Duration**: Song length in seconds
- **Album Art**: Cover image (resized to 300x300px for optimal display)

### 🔄 **Fallback System**
When metadata tags are not available, the system intelligently parses filenames using patterns like:
- `Artist - Song Title`
- `Artist - Album - Song Title`
- `Artist - Song Title (Year)`

---

## 🎮 Controls

### 🖱️ **Mouse Controls**
| Action | Description |
|--------|-------------|
| **Upload Music** | Click to select individual audio files |
| **Upload Folder** | Click to select entire folders (auto-filters audio) |
| **Play/Pause** | Click the center play button |
| **Skip Tracks** | Use previous/next buttons |
| **Seek** | Click or drag on progress bar |
| **Volume** | Click or drag on volume bar |
| **Play Track** | Click any track in the playlist |
| **Create Playlist** | Click "New Playlist" button |
| **Switch Playlists** | Click playlist tabs |
| **Settings** | Click gear icon (bottom right) |
| **Remove Track** | Hover and click X on playlist items |

### ⌨️ **Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Previous track |
| `→` | Next track |
| `↑` | Volume up (+5%) |
| `↓` | Volume down (-5%) |
| `M` | Mute/Unmute |
| `S` | Toggle shuffle |
| `R` | Cycle repeat modes |
| `Esc` | Clear selection |

### 🎛️ **Player Functions**
- **Shuffle**: Randomize track order
- **Repeat**: Cycle through no repeat → repeat all → repeat one
- **Clear**: Remove all tracks from current playlist
- **Theme Toggle**: Switch between light and dark modes

---

## 🛠️ Technical Details

### 🏗️ **Architecture**
- **Frontend**: Pure HTML5, CSS3, and Vanilla JavaScript
- **Backend**: Python HTTP server with mutagen library
- **Storage**: IndexedDB for persistent file storage
- **Metadata**: Python-based extraction with JavaScript fallback
- **Album Art**: Base64 encoded images with automatic resizing

### 🎯 **Performance**
- **Lazy Loading**: Tracks loaded on demand
- **Memory Efficient**: Automatic cleanup of unused resources
- **Image Optimization**: Album art resized to 300x300px maximum
- **Smooth Animations**: Hardware-accelerated CSS transitions
- **Responsive**: Optimized for all screen sizes

### 🌐 **Browser Compatibility**
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

### 🐍 **Python Dependencies**
- **mutagen**: Audio metadata extraction
- **Pillow**: Image processing for album art
- **http.server**: Built-in HTTP server

---

## 🎯 Pro Tips

### 🎵 **Music Management**
1. **Use Python Server**: For full metadata and album art support
2. **Bulk Upload**: Select multiple files at once for quick playlist building
3. **Folder Upload**: Use "Upload Folder" to add entire music directories
4. **Custom Playlists**: Create themed collections (e.g., "Workout", "Chill", "Party")
5. **Drag & Drop**: Drag files directly onto the player for instant upload

### 🎨 **Album Art & Metadata**
6. **Tag Your Files**: Use tools like MP3Tag to add proper metadata
7. **Album Art Quality**: Higher resolution images are automatically resized
8. **Fallback Parsing**: Ensure filenames follow "Artist - Title" format for best results
9. **Theme Switching**: Album art displays properly in both light and dark modes

### ⚡ **Performance**
10. **Python Server**: Always use the Python server for best experience
11. **Memory Management**: The player automatically cleans up unused files
12. **Error Handling**: Failed metadata extraction gracefully falls back to filename parsing

### ⌨️ **Keyboard Mastery**
13. **Volume Control**: Use ↑/↓ arrows for precise 5% volume adjustments
14. **Quick Shuffle**: Press S to instantly toggle shuffle mode
15. **Repeat Modes**: Press R to cycle through repeat options
16. **Volume Feedback**: Volume changes show notifications in bottom left

---

## 🔧 Installation & Setup

### 📦 **Automatic Setup (Recommended)**
```bash
# Run the dependency installer
python install_dependencies.py
```

### 🔧 **Manual Setup**
```bash
# Install Python dependencies
pip install mutagen>=1.47.0
pip install Pillow>=9.0.0

# Start the server
python server.py
```

### 📁 **File Structure**
```
Liquid-Music/
├── index.html              # Main application
├── script.js               # Core functionality
├── styles.css              # Styling and animations
├── server.py               # Python HTTP server
├── metadata_reader.py      # Metadata extraction engine
├── install_dependencies.py # Dependency installer
├── requirements.txt        # Python dependencies
├── METADATA_README.md      # Metadata system documentation
└── README.md              # This file
```

---

## 📱 Mobile Experience

The Liquid Glass Music Player is fully responsive and optimized for mobile devices:

- **Touch-Friendly**: Large, easy-to-tap controls
- **Album Art Display**: Properly scaled for mobile screens
- **Adaptive Layout**: Automatically adjusts to screen size
- **Performance Optimized**: Smooth experience on mobile devices
- **Theme Support**: Dark mode optimized for mobile viewing

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Bugs**: Found an issue? Let us know!
2. **Feature Requests**: Have an idea? We'd love to hear it!
3. **Code Contributions**: Submit pull requests for improvements
4. **Documentation**: Help improve our documentation
5. **Testing**: Test on different browsers and devices
6. **Metadata Support**: Help add support for additional audio formats

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎵 Start Your Musical Journey

<div align="center">

**Ready to experience music like never before?**

[🚀 Get Started Now](#-quick-start) • [📊 Learn About Metadata](#-metadata-system) • [⭐ Star This Project](#)

---

*Made with ❤️ by a solo developer for music lovers everywhere*

**Version: v5.2.0**

</div>