# 🎵 Liquid Glass Music Player

A beautiful, modern music player with a sleek liquid glass design, dark theme, and smooth animations. Upload your music files and enjoy a premium listening experience.

## ✨ Features

- **Liquid Glass Design**: Beautiful glassmorphism effects with backdrop blur
- **Dark Theme**: Sleek dark interface with gradient orbs and smooth animations
- **File Upload**: Upload individual files or entire folders with automatic audio detection
- **Custom Playlists**: Create, name, and manage multiple playlists with custom album covers
- **Persistent Storage**: All playlists and settings are saved locally and restored on reload
- **Advanced Controls**: Play, pause, skip, shuffle, repeat modes
- **Smooth Volume Control**: Real-time volume adjustment with drag support
- **Progress Bar**: Interactive progress bar with time display and seeking
- **Responsive Design**: Works perfectly on desktop and mobile
- **Keyboard Shortcuts**: Space to play/pause, arrow keys to skip, M to mute
- **Hover Effects**: Smooth animations and visual feedback on all interactions

## 🚀 Quick Start

### Option 1: Python Server (Recommended)
```bash
python server.py
```
Then open http://localhost:8000 in your browser.

### Option 2: Direct File Access
Simply open `index.html` in your web browser.

## 🎮 Controls

### Mouse Controls
- **Upload Music**: Click to select individual audio files
- **Upload Folder**: Click to select entire folders (automatically filters for audio files)
- **Play/Pause**: Click the center play button
- **Skip**: Use previous/next buttons
- **Progress**: Click or drag on progress bar to seek
- **Volume**: Click or drag on volume bar to adjust (smooth real-time control)
- **Playlist**: Click any track to play it
- **New Playlist**: Click "New Playlist" to create custom playlists with names and covers
- **Playlist Tabs**: Click tabs to switch between playlists
- **Remove**: Hover over playlist items and click the X

### Keyboard Shortcuts
- **Space**: Play/Pause
- **Left Arrow**: Previous track
- **Right Arrow**: Next track
- **M**: Mute/Unmute

### Button Functions
- **Shuffle**: Randomize track order
- **Repeat**: Cycle through no repeat → repeat all → repeat one
- **Clear**: Remove all tracks from current playlist
- **New Playlist**: Create custom playlists with names and album covers
- **Playlist Tabs**: Switch between different playlists

## 🎨 Design Features

- **Glassmorphism**: Translucent cards with backdrop blur effects
- **Gradient Orbs**: Animated background elements for visual appeal
- **Smooth Animations**: Hover effects, transitions, and micro-interactions
- **Modern Icons**: Font Awesome icons for all controls
- **Responsive Layout**: Adapts to different screen sizes
- **Loading States**: Visual feedback during track loading

## 📁 Supported Audio Formats

The player supports all audio formats that your browser can play, including:
- MP3
- WAV
- OGG
- M4A
- FLAC (in supported browsers)

## 🛠️ Technical Details

- **Pure HTML/CSS/JavaScript**: No external dependencies except Font Awesome icons
- **Web Audio API**: Uses native browser audio capabilities
- **Object URLs**: Efficient memory management for uploaded files
- **Event-Driven**: Responsive to user interactions and audio events
- **Cross-Browser**: Works in all modern browsers

## 🎯 Usage Tips

1. **Upload Multiple Files**: Select multiple audio files at once for quick playlist building
2. **Upload Folders**: Use the "Upload Folder" button to add entire music directories at once
3. **Create Custom Playlists**: Use the "New Playlist" button to organize your music into themed collections
4. **Add Album Covers**: Upload custom images for your playlists to make them visually appealing
5. **Persistent Storage**: All your playlists and settings are automatically saved and restored
6. **Smooth Controls**: Drag the volume and progress bars for precise control
7. **Keyboard Navigation**: Use keyboard shortcuts for quick control
8. **Mobile Friendly**: Touch-friendly interface for mobile devices
9. **Memory Management**: The player automatically cleans up file URLs when tracks are removed

## 🔧 Customization

The player is built with modular CSS and JavaScript, making it easy to customize:

- **Colors**: Modify the CSS custom properties for different color schemes
- **Animations**: Adjust timing and easing functions in the CSS
- **Layout**: Change the grid layout in the CSS for different arrangements
- **Features**: Add new functionality by extending the JavaScript class

## 📱 Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🎵 Enjoy Your Music!

Upload your favorite tracks and enjoy the premium listening experience with the Liquid Glass Music Player!
